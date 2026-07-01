# UltimateUI Web Editor

A community-driven web editor for the [UltimateUI PaperMC plugin](https://builtbybit.com/resources/ultimate-ui.105345/) by **Xqedii**. This project aims to mirror the in-game editor experience with better performance and accessibility, right in your browser.

Built with Next.js 16, React 19, shadcn/ui components, and Tailwind CSS 4.

---

## Requirements

- [Node.js](https://nodejs.org/) v20 or later
- [pnpm](https://pnpm.io/) (recommended) — or npm/yarn

---

## Installation

```bash
# Clone the repository
git clone https://github.com/SLNE-Development/ultimateui-webeditor.git
cd ultimateui-webeditor

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Updating

```bash
# Pull the latest changes
git pull

# Install any new or updated dependencies
pnpm install

# Restart the dev server
pnpm dev
```

If you are running a production build, rebuild after updating:

```bash
pnpm build
pnpm start
```

---

## Contributing

Contributions are welcome from the community. Here is how to get started:

1. **Fork** the repository on GitHub.
2. **Create a branch** for your feature or fix:
    ```bash
    git checkout -b feat/your-feature-name
    ```
3. **Make your changes.** Keep PRs focused - one feature or fix per PR.
4. **Run the linter** before committing:
    ```bash
    pnpm lint
    ```
5. **Open a Pull Request** against `master` with a clear description of what you changed and why.

### Guidelines

- Use shadcn/ui components where possible — avoid pulling in new UI libraries without discussion.
- Keep editor behaviour consistent with the in-game UltimateUI editor.
- Open an issue first for large features so the direction can be agreed on before you invest time.

---

## Credits

- **Xqedii** — original author and developer of the [UltimateUI PaperMC plugin](https://builtbybit.com/resources/ultimate-ui.105345/)
- All community contributors who have helped build and improve this web editor

---

## License

This project is community-maintained and not officially affiliated with or endorsed by the original plugin author.
