# Kakeibo

A personal finance dashboard in the style of Monarch, built to run on your own machine. Your data stays with you.

It covers:

- **Overview**: net worth, this month's income, spending and savings, budget progress, upcoming bills, and plain-language takeaways.
- **Transactions**: every account in one list. You can search and filter by type, account, category, tag or property. The tabs are *Needs review*, *Uncategorized*, *Split* and *Hidden*. You can change a category right in the list, split a transaction between categories, select several to edit at once, and set merchant rules.
- **Cash flow**: a Sankey diagram of where the money went (by group, by category, or both) or a profit & loss table. There are income and expense breakdowns by category or merchant, and a month-by-month view.
- **Spending**: totals and a donut chart by group, category or merchant. Click rows to chart their trend over time.
- **Net worth**: assets and liabilities over time, in total or by account type. You can chart and compare individual accounts.
- **Budget**: monthly budgets per category, which you can fill from your 3-month averages, plus the kakeibo end-of-month reflection.
- **Recurring**: subscriptions, bills and paychecks found from repeating charges, with their next expected dates.
- **Loans**: payoff progress, interest, and the estimated payoff date.
- **Properties**: each property gets its own page with monthly cash flow, income, expenses and equity. Only its *net* cash flow feeds your household numbers, so a rental's mortgage doesn't swamp your everyday budget.
- **Copy summary for Claude**: puts a text summary of the last three months on your clipboard to paste into a chat.

It opens with a sample household so you can look around. The sample goes away when your own data arrives.

## Two ways to run it

### 1. Browser only

Open `index.html` from any static host, such as GitHub Pages or `python3 -m http.server`. Data is kept in that browser's local storage. You import CSV exports from your bank and can back up to a JSON file. There's no bank sync in this mode.

### 2. With the companion server (bank sync, data on disk)

You need Node 18 or newer. The server has no dependencies to install.

```sh
cd finance
node server.mjs
# → http://localhost:8787
```

The server:

- serves the app
- saves everything to `finance/data/state.json`, with one backup per day in `data/backups/`
- connects to SimpleFIN Bridge, so the key that reads your banks never reaches the browser

Every browser that opens the app sees the same data, including your phone. Set the server's options with environment variables:

| Variable | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` to reach it from other devices on your network |
| `KAKEIBO_PASSWORD` | none | Asks for a password (any username). **Set this whenever `HOST` isn't localhost.** |
| `KAKEIBO_DATA` | `./data` | Where data and the SimpleFIN key are stored |

## Connecting your banks (SimpleFIN)

1. Create an account at [SimpleFIN Bridge](https://beta-bridge.simplefin.org). It costs about $1.50 a month.
2. Link your banks there.
3. In SimpleFIN Bridge, create a **setup token**.
4. In Kakeibo, open **Settings & sync**, paste the token and choose **Connect**.

The server exchanges the token for an access key. The key is stored in `data/secrets.json`, readable only by the user running the server. After that, **Sync banks** pulls in new transactions:

- The first sync reaches back 90 days.
- Later syncs pick up where the last one ended, re-checking the two weeks before it.
- Accounts are created automatically, and the type (checking, card, loan, retirement…) is guessed from the name. You can change it in Accounts.
- New transactions go to *Needs review*.

## Running it on a home server

The community suggestions from the original Reddit thread all work: a spare mini-PC, a Raspberry Pi, or a free-tier VM. Here's a systemd unit for a Pi:

```ini
# /etc/systemd/system/kakeibo.service
[Unit]
Description=Kakeibo
After=network-online.target

[Service]
WorkingDirectory=/home/pi/japan/finance
ExecStart=/usr/bin/node server.mjs
Environment=HOST=0.0.0.0
Environment=KAKEIBO_PASSWORD=change-me
Restart=on-failure
User=pi

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl enable --now kakeibo
```

To use it away from home, put it behind [Tailscale](https://tailscale.com) rather than opening a port on your router. Then add it to your phone's home screen; it opens full-screen like an app.

## Importing CSV files

Most banks let you download transactions as CSV. Kakeibo finds the date, description and amount columns on its own, including files with separate money-in and money-out columns, European number formats, and day-first dates. It categorizes each row and skips duplicates, so importing an overlapping file twice is safe. Check the preview before you import.

## Your data

Everything is one JSON document:

- In browser-only mode it's in local storage.
- With the server, it's in `data/state.json`.

**Settings & sync → Back up everything** downloads the same document, and **Restore a backup** loads one. `data/` is in `.gitignore`, so it won't be committed by accident.

## Ideas for later

- A **Plaid** connector. It's free for a handful of accounts on the developer plan, but needs a hosted Link flow.
- Reading from and writing to **Actual Budget**, through its Node API, the way the original SharkFin setup did.
- Scheduled syncs. Today a sync runs when you press the button, because the app merges new transactions in the browser. Moving that merge into the server would allow a nightly sync.
