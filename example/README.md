# Synnel Full-Stack Example 🚀

A comprehensive demonstration of Synnel's capabilities, featuring real-time multi-user chat and mouse cursor tracking with minimal overhead.

## Features in this Example

1. **Chat App**: Multi-user real-time chat with optimistic updates.
2. **Mouse Tracker**: Visualization of everyone's cursor position on the screen.
3. **Throttling**: The mouse tracker uses 50ms throttling to minimize signal noise.
4. **Cleanup**: Intelligent stale-client cleanup on the browser.
5. **Connection Quality**: Displays real-time connection status (`connecting`, `open`).

## 🚀 How to Run

From the root project directory:

### 1. Install Dependencies

```bash
bun install
```

### 2. Start the Backend Server

```bash
# Terminal 1
bun example/server/index.ts
```

### 3. Start the Frontend Application

```bash
# Terminal 2
cd example && bun run dev
```

The application will be available at `http://localhost:5173`. Open multiple browser tabs to see the real-time synchronization in action!

## Project Structure

- `server/index.ts`: The Synnel server setup with Express integration.
- `src/App.tsx`: Main application wrapper.
- `src/Chat.tsx`: Real-time chat component using `useChannel`.
- `src/MouseTracker.tsx`: Throttled multi-user positioning component.

## License

MIT
{
files: ['**/*.{ts,tsx}'],
extends: [
// Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },

},
])

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
