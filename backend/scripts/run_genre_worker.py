"""Run the reading analysis queue. Start from team04-reading-game."""
import argparse
from contextlib import closing
import os
from time import sleep

from backend.app.genre_analysis import GENRES, AnalysisError, gemini_parser, openai_parser
from backend.app.genre_jobs import enqueue, jobs_enabled, publish_character_reward, run_character_design, run_concept_flow, run_one, run_solar_research_map
from backend.app.poetry_analysis import run_poetry_study
from backend.app.reading import now, open_db, write_transaction
from backend.app.reading_identity import production


def main():
    args_parser = argparse.ArgumentParser(description=__doc__)
    mode = args_parser.add_mutually_exclusive_group()
    mode.add_argument("--once", action="store_true", help="Process one queued analysis and exit.")
    mode.add_argument("--enqueue", metavar="BOOK_ID", help="Queue a selected existing book.")
    mode.add_argument("--solar-research-map", action="store_true", help="Generate and publish only the solar paper's research map.")
    mode.add_argument("--character-design", metavar="BOOK_ID", help="Generate draft character designs for a selected book.")
    mode.add_argument("--publish-character-reward", metavar="BOOK_ID", help="Publish a reviewed character and completion reward.")
    mode.add_argument("--concept-flow", metavar="BOOK_ID", help="Generate a textbook concept flow.")
    mode.add_argument("--poetry-study", metavar="BOOK_ID", help="Generate a poetry dictionary and exam.")
    args_parser.add_argument("--category", choices=GENRES, help="Explicitly classify the selected existing book.")
    args = args_parser.parse_args()
    if production() or os.getenv("VERCEL"):
        args_parser.error("Production analysis runs inside the upload request.")
    if args.category and not args.enqueue:
        args_parser.error("--category requires --enqueue")
    if args.enqueue:
        with closing(open_db()) as conn, write_transaction(conn):
            if not jobs_enabled(conn):
                args_parser.error("Apply the genre analysis migration first.")
            book = conn.execute("SELECT category FROM books WHERE id = ?", (args.enqueue,)).fetchone()
            if not book or (args.category or book["category"]) not in GENRES:
                args_parser.error("Select an existing book with a supported genre.")
            if not enqueue(conn, args.enqueue, now()):
                args_parser.error("This book already has a queued, running or ready analysis.")
            if args.category and args.category != book["category"]:
                conn.execute("UPDATE books SET category = ? WHERE id = ?", (args.category, args.enqueue))
        return
    if args.solar_research_map or args.character_design or args.publish_character_reward or args.concept_flow or args.poetry_study:
        try:
            if args.poetry_study:
                run_poetry_study(args.poetry_study, gemini_parser())
            elif args.concept_flow:
                run_concept_flow(args.concept_flow, gemini_parser())
            elif args.publish_character_reward:
                publish_character_reward(args.publish_character_reward, gemini_parser())
            elif args.character_design:
                run_character_design(args.character_design, gemini_parser())
            else:
                run_solar_research_map(gemini_parser())
        except AnalysisError as error:
            args_parser.exit(1, f"Gemini analysis was not saved: {error}\n")
        print("Gemini analysis saved.")
        return
    if not os.getenv("OPENAI_API_KEY") or not os.getenv("READING_OPENAI_MODEL"):
        args_parser.error("Set OPENAI_API_KEY and READING_OPENAI_MODEL in backend/.env.")
    parse = openai_parser()
    if args.once:
        run_one(parse)
        return
    while True:
        if not run_one(parse):
            sleep(2)


if __name__ == "__main__":
    main()
