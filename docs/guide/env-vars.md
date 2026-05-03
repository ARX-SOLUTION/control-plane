# Environment Variables

Env vars are stored **encrypted** (AES-256-GCM envelope encryption) and decrypted only when injected into a container at deploy time, or when explicitly revealed.

## Adding a Variable

1. Project → **Env Vars** tab
2. Select the environment from the dropdown
3. Type the key (auto-uppercased, format: `[A-Z_][A-Z0-9_]*`)
4. Type the value (masked input)
5. Click **Add**

## Revealing a Value

Click the eye icon on a variable row. The value is shown for **30 seconds**, then hidden automatically.

## Updating a Value

Click the pencil icon → enter new value → save. A new encrypted version is stored; the old one is discarded.

## Toggling Active State

Each variable can be toggled active/inactive. Inactive variables are not injected at deploy time.

## Deleting a Variable

Click the trash icon → confirm. The variable is permanently removed.

::: tip
Variables are injected into the container as standard `ENV` at the start of each deployment. They are never written to disk in plaintext.
:::
