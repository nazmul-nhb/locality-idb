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

# Build package
pnpm run build

# Type check
pnpm run typecheck

# Run package in development mode (watch for changes)
pnpm run dev:pkg

# Run demo implementation (raw html ts project with vite)
pnpm run dev

# Build demo implementation project
pnpm run build:demo
```

## Reporting Issues

Please report issues on the [GitHub issue tracker](https://github.com/nazmul-nhb/locality-idb/issues).

When reporting an issue, please include:

- A clear and descriptive title
- A detailed description of the problem
- Steps to reproduce the issue
- Expected and actual behavior

## Submitting Pull Requests

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with clear messages.
4. Push your changes to your fork.
5. Open a pull request against the `main` branch of the original repository.
6. Ensure your code passes all tests and adheres to the project's coding standards.
7. Provide a detailed description of your changes in the pull request.

Thank you for contributing to Locality IndexedDB! Your efforts help make this project better for everyone.
