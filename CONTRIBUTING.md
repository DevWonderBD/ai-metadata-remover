# Contributing to AI Metadata Remover

Thank you for your interest in contributing to **AI Metadata Remover**, an open-source initiative by [DevWonder](https://github.com/DevWonderBD)! We welcome contributions from developers, designers, and privacy advocates around the world.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors with respect.

## How Can I Contribute?

- **Reporting Bugs:** Check the [issue tracker](https://github.com/DevWonderBD/ai-metadata-remover/issues) to ensure the bug hasn't already been reported. If not, open a new issue using our Bug Report template.
- **Suggesting Enhancements:** Feature ideas are welcome! Open a Feature Request with details on what problem it solves.
- **Code Contributions:** Fix a bug or implement a requested feature from our issues list.
- **Documentation & Localization:** Improve guides, translate the UI, or write tutorials.

## Development Workflow

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `pnpm`

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/DevWonderBD/ai-metadata-remover.git
cd ai-metadata-remover

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 3. Making Changes
1. Fork the repository and create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes adhering to project architecture (100% client-side privacy, zero server image uploads).
3. Ensure the project builds cleanly without errors:
   ```bash
   npm run build
   ```

### 4. Commit Guidelines
We strictly adhere to [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(scope): add new capability`
- `fix(scope): resolve bug or glitch`
- `docs(scope): documentation updates`
- `style(scope): formatting, styling changes`
- `refactor(scope): code restructuring without behavior changes`
- `perf(scope): performance improvements`
- `test(scope): adding or updating tests`

### 5. Submitting a Pull Request
- Push your branch to your fork.
- Open a Pull Request pointing to the `main` branch.
- Fill out the PR template thoroughly. Maintainers will review your PR promptly!
