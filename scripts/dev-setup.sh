#!/usr/bin/env bash
set -euo pipefail

echo "=== Release Loop OS — Dev Setup ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Run: npm install -g pnpm"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.11+ is required."; exit 1; }

echo ""
echo "1. Installing Node.js dependencies..."
pnpm install

echo ""
echo "2. Setting up Python scoring service..."
cd services/scoring
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

echo ""
echo "3. Copying environment file..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env — please fill in your credentials."
else
  echo "   .env already exists, skipping."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Fill in .env with your Spotify and database credentials"
echo "  2. Start PostgreSQL and Redis"
echo "  3. Run: pnpm db:push"
echo "  4. Run: pnpm dev"
echo "  5. In another terminal: cd services/scoring && uvicorn app.main:app --reload"
