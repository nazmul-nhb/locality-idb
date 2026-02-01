# 🤝 Contributing

Contributions are welcome! Whether it's reporting bugs, suggesting features, or submitting pull requests, your help is appreciated.

## Development Setup

> This project uses [pnpm](https://pnpm.io/) as the package manager. Make sure you have it installed globally.

```bash
# Clone the repository
git clone https://github.com/nazmul-nhb/locality-idb.git
cd locality-idb

# Install dependencies
pnpm install
```

## Available Scripts

### Required Scripts

These are the essential scripts you'll need for development:

```bash
# Build the package
pnpm run build

# Run type checking
pnpm run typecheck

# Development mode with watch (rebuilds on file changes)
pnpm run dev:pkg
```

### Demo Application

Test your changes in the demo application:

```bash
# Run demo in development mode
pnpm run dev

# Build demo for production
pnpm run build:demo

# Preview built demo
pnpm run preview
```

### Optional Developer Tools

These scripts use [nhb-scripts](https://www.npmjs.com/package/nhb-scripts) for code quality and developer experience:

```bash
# Format code with Prettier (configured in nhb.scripts.config.mjs)
pnpm run format

# Lint code with ESLint
pnpm run lint

# Interactive commit helper with conventional commits + emojis
pnpm run commit

# Count lines of code
pnpm run count

# Delete build artifacts and node_modules
pnpm run delete
```

> **Note:** You don't need to install nhb-scripts separately - it's already in devDependencies. These tools are optional but recommended for maintaining code quality.

## Development Workflow

1. **Make your changes** in the `src/` directory
2. **Run type checking** with `pnpm run typecheck` to ensure type safety
3. **Test in the demo** with `pnpm run dev` to see your changes in action
4. **Format your code** (optional but recommended): `pnpm run format`
5. **Build the package** with `pnpm run build` before committing

## Code Quality

While we don't have automated tests yet, please ensure:

- ✅ TypeScript compiles without errors (`pnpm run typecheck`)
- ✅ Code is formatted consistently (`pnpm run format`)
- ✅ No linting errors (`pnpm run lint`)
- ✅ Changes work correctly in the demo application
- ✅ Documentation is updated if adding/changing public APIs

## Reporting Issues

Please report issues on the [GitHub issue tracker](https://github.com/nazmul-nhb/locality-idb/issues).

When reporting an issue, please include:

- A clear and descriptive title
- A detailed description of the problem
- Steps to reproduce the issue
- Expected and actual behavior
- Browser and version (since this is a browser-based library)

## Submitting Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bug fix: `git checkout -b feature/my-feature`
3. Make your changes in the `src/` directory
4. Run `pnpm run typecheck` to ensure no TypeScript errors
5. Test your changes in the demo: `pnpm run dev`
6. (Optional but recommended) Format and lint: `pnpm run format && pnpm run lint`
7. Build the package: `pnpm run build`
8. Commit your changes with clear, descriptive messages
9. Push to your fork: `git push origin feature/my-feature`
10. Open a pull request against the `main` branch
11. Provide a detailed description of your changes in the pull request

### Commit Message Guidelines (Optional)

If you use `pnpm run commit`, it will guide you through creating conventional commits with emojis like:

- `🐛 fix: Fix count method for index-based queries`
- `✨ feat: Add new sortByIndex method`
- `📝 docs: Update README with new examples`
- `♻️ refactor: Improve query builder performance`

But regular descriptive commit messages are perfectly fine too!

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Check existing issues and pull requests
- Review the code structure in `src/`

Thank you for contributing to `Locality IDB`! Your efforts help make this project better for everyone. 🙏
