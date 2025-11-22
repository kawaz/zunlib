# zunlib

A collection of small utility functions and types for JavaScript/TypeScript.

## Project Overview

This is `@kawaz/zunlib` - a personal utility library consolidating small, independent functions that were originally stored as gists.

## Development Guidelines

### Package Manager
- Use **bun** exclusively
- `bun install` for dependencies
- `bun test` for testing
- `bun run build` for building

### Tooling
- **Linter/Formatter**: oxlint (`bun run lint`, `bun run format`)
- **Bundler**: bun build (with tree-shaking support)
- **TypeScript**: Strict mode enabled

### Code Structure
- Each utility lives in its own file: `src/{utility}.ts`
- All exports aggregated in `src/index.ts`
- Tests alongside source: `src/{utility}.test.ts`
- Keep utilities independent - no cross-dependencies between utilities

### Adding New Utilities
1. Create `src/{name}.ts` with the implementation
2. Create `src/{name}.test.ts` with tests
3. Export from `src/index.ts`
4. Add to `package.json` exports if standalone import is desired
5. Update build script to include the new entry point

### Design Principles
- Self-contained: Each utility should work independently
- Tree-shakeable: No side effects, proper ESM exports
- TypeScript-first: Full type safety with exported types
- Minimal: Only include what's needed, no over-engineering

### npm Publishing
- Package name: `@kawaz/zunlib`
- Auto-publish on main branch push when version changes
- Requires `NPM_TOKEN` secret in GitHub

### Commands
```bash
bun install      # Install dependencies
bun run lint     # Run linter
bun run format   # Format code
bun test         # Run tests
bun run build    # Build for production
```

## Planned Utilities
- debounce - Debounce function calls
- throttle - Throttle function calls
- binconv - Binary conversion utilities
- worker - Web Worker helpers
- duckdb - DuckDB utilities
- datetime - Date/time utilities
