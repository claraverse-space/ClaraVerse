#!/bin/bash

echo "Installing test dependencies..."
npm install --save-dev @testing-library/jest-dom @testing-library/react @testing-library/user-event @vitest/coverage-v8 @vitest/ui jsdom vitest

echo "Verifying vitest installation..."
npx vitest --version

echo "Setup complete! Run tests with: npm test"
