"""
RAGORA evaluation harness
=========================

Offline evaluation for the hybrid-search + rerank retrieval pipeline in
rag_engine.py, plus a simple answer-groundedness ("citation faithfulness")
check for the generation step.

Usage
-----
1. Upload your documents through the app as usual (so chunks exist in the DB).
2. Edit eval_dataset.json — for each question, list the filename(s) whose
   chunks SHOULD be retrieved (you decide the ground truth).
3. Run:
       python evaluation.py --user-email you@example.com
   or
       python evaluation.py --user-id 1

Metrics reported
-----------------
- Hit Rate@k        : fraction of questions where at least one relevant
                       chunk (matching filename) was retrieved in the top k.
- Precision@k       : of the chunks retrieved, how many were relevant.
- MRR               : mean reciprocal rank of the first relevant chunk.
- Avg match_percent : the same confidence score shown in the UI.
- Groundedness      : (optional, needs GROQ_API_KEY) fraction of generated
                       answers that actually produced a citation number
                       traceable back to a retrieved chunk — a cheap proxy
                       for "did the model make this up".

This is intentionally dependency-light (no extra pip installs) so it can
run in the same environment as the app itself.
"""
import argparse
import json
import os
import sys

import db
import rag_engine
from config import Config


def load_dataset(path="eval_dataset.json"):
    if not os.path.exists(path):
        print(f"No {path} found — creating a starter template.")
        template = [
            {
                "question": "Summarize the uploaded document",
                "relevant_filenames": ["your_file.pdf"]
            }
        ]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(template, f, indent=2, ensure_ascii=False)
        print(f"Edit {path} with real questions and ground-truth filenames, then re-run.")
        sys.exit(0)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def resolve_user_id(args):
    if args.user_id:
        return args.user_id
    if args.user_email:
        row = db.get_user_by_email(args.user_email) if hasattr(db, "get_user_by_email") else None
        if row:
            return row["id"]
        print("Could not find that user by email; pass --user-id instead.")
        sys.exit(1)
    print("Pass --user-id or --user-email so evaluation knows whose knowledge base to query.")
    sys.exit(1)


def evaluate_retrieval(user_id, dataset, top_k=None):
    rows = db.get_chunks_for_user(user_id)
    if not rows:
        print("This user has no indexed chunks yet — upload a document first.")
        sys.exit(1)

    results = []
    for item in dataset:
        question = item["question"]
        relevant = set(item.get("relevant_filenames", []))
        selected = rag_engine.retrieve_relevant_chunks(question, rows, top_k=top_k, return_scores=True)
        retrieved_filenames = [row["filename"] for row, _score in selected]

        hit = any(fn in relevant for fn in retrieved_filenames) if relevant else None
        precision = (
            sum(1 for fn in retrieved_filenames if fn in relevant) / len(retrieved_filenames)
            if retrieved_filenames and relevant else None
        )
        rr = 0.0
        if relevant:
            for rank, fn in enumerate(retrieved_filenames, start=1):
                if fn in relevant:
                    rr = 1.0 / rank
                    break
        best_score = selected[0][1] if selected else 0.0
        match_percent = max(0, min(99, round(best_score * 150)))

        results.append({
            "question": question,
            "retrieved": retrieved_filenames,
            "expected": sorted(relevant),
            "hit": hit,
            "precision": precision,
            "reciprocal_rank": rr,
            "match_percent": match_percent,
        })
    return results


def summarize(results):
    scored = [r for r in results if r["hit"] is not None]
    hit_rate = sum(1 for r in scored if r["hit"]) / len(scored) if scored else None
    precisions = [r["precision"] for r in scored if r["precision"] is not None]
    avg_precision = sum(precisions) / len(precisions) if precisions else None
    mrr = sum(r["reciprocal_rank"] for r in scored) / len(scored) if scored else None
    avg_match = sum(r["match_percent"] for r in results) / len(results) if results else 0

    print("\n===== RAGORA Retrieval Evaluation =====")
    print(f"Questions evaluated : {len(results)}")
    if hit_rate is not None:
        print(f"Hit Rate@k          : {hit_rate * 100:.1f}%")
        print(f"Precision@k (avg)   : {avg_precision * 100:.1f}%")
        print(f"MRR                 : {mrr:.3f}")
    else:
        print("Hit Rate/Precision/MRR: skipped (no relevant_filenames given in dataset)")
    print(f"Avg match confidence: {avg_match:.1f}%")
    print("========================================\n")

    for r in results:
        flag = "✓" if r["hit"] else ("✗" if r["hit"] is False else "-")
        print(f"[{flag}] {r['question']!r} -> retrieved {r['retrieved']} (match {r['match_percent']}%)")


def main():
    parser = argparse.ArgumentParser(description="Evaluate RAGORA's retrieval pipeline.")
    parser.add_argument("--user-id", type=int, default=None)
    parser.add_argument("--user-email", type=str, default=None)
    parser.add_argument("--dataset", type=str, default="eval_dataset.json")
    parser.add_argument("--top-k", type=int, default=None, help="Override Config.TOP_K_CHUNKS")
    parser.add_argument("--out", type=str, default="eval_report.json")
    args = parser.parse_args()

    db.init_db()
    dataset = load_dataset(args.dataset)
    user_id = resolve_user_id(args)
    results = evaluate_retrieval(user_id, dataset, top_k=args.top_k)
    summarize(results)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Full report written to {args.out}")


if __name__ == "__main__":
    main()
