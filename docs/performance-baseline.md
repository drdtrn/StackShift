# Performance Baseline — StackSift Frontend

**Epic:** EPIC-08 Quality & Observability  
**Date recorded:** 2026-04-17  
**Environment:** Next.js 16 / React 19, local development build (`pnpm build`)

---

## 1. Lighthouse Scores (targets)

Scores must be measured with Lighthouse in Chrome DevTools or `lighthouse` CLI against a **production build** (`pnpm build && pnpm start`) with the mock auth flag set (`NEXT_PUBLIC_AUTH_MOCK=true`).

### How to run

```bash
# Build and serve
cd src/frontend
pnpm build && pnpm start        # http://localhost:3000

# CLI (requires lighthouse globally)
npx lighthouse http://localhost:3000 --output html --output-path ./lighthouse-overview.html --only-categories=performance,accessibility,best-practices
npx lighthouse http://localhost:3000/logs --output html --output-path ./lighthouse-logs.html --only-categories=performance,accessibility,best-practices
```

### Desktop targets (all key pages)

| Page | Performance | Accessibility | Best Practices |
|---|---|---|---|
| `/` (Overview) | ≥ 90 | ≥ 95 | ≥ 90 |
| `/logs` (Log Explorer) | ≥ 90 | ≥ 95 | ≥ 90 |
| `/incidents` | ≥ 90 | ≥ 95 | ≥ 90 |
| `/alerts` | ≥ 90 | ≥ 95 | ≥ 90 |
| `/projects` | ≥ 90 | ≥ 95 | ≥ 90 |

### Core Web Vitals targets (desktop)

| Metric | Target | Notes |
|---|---|---|
| FCP (First Contentful Paint) | < 1.5 s | Fonts use `display: swap`; anti-FOUC script is inlined |
| LCP (Largest Contentful Paint) | < 2.5 s | Logo image uses `priority` to preload |
| CLS (Cumulative Layout Shift) | < 0.1 | No unsized images; no layout-shifting ads |

---

## 2. Bundle Analysis

### How to run

```bash
cd src/frontend
pnpm analyze   # ANALYZE=true next build — opens .next/analyze/*.html
```

The report opens two treemaps:
- **client.html** — client-side JavaScript bundles
- **nodejs.html** — server-side rendering bundles

### Chunk size limit

No single **route chunk** may exceed **150 KB gzipped** (the Next.js shared framework chunk is excluded from this limit).

To verify gzip sizes after `pnpm build`:

```bash
# All JS chunks in the build output
find .next/static/chunks -name "*.js" | sort | xargs -I{} sh -c 'gzip -c {} | wc -c | tr -d "\n"; echo " {}"' | sort -n
```

### Optimizations applied (EPIC-08)

| Optimization | File(s) changed | Why |
|---|---|---|
| `@next/bundle-analyzer` configured | `next.config.ts`, `package.json` | Enables `pnpm analyze` to inspect bundle composition |
| `optimizePackageImports` for `lucide-react` + `framer-motion` | `next.config.ts` | Tree-shakes icon/animation exports not used by any route |
| AVIF + WebP image formats | `next.config.ts` (`images.formats`) | Reduces image payload 30–50 % vs PNG/JPEG |
| 30-day image cache TTL | `next.config.ts` (`images.minimumCacheTTL`) | Avoids re-processing identical logo requests |
| gzip compression enabled | `next.config.ts` (`compress: true`) | Explicit; default in Next.js but documented here |

---

## 3. Code Splitting

Heavy, client-only components are lazy-loaded with `next/dynamic`. The route chunk that boots each page is kept small; the heavy code only downloads when the user navigates to that route.

| Route | Component split | Reason |
|---|---|---|
| `/logs` | `LiveLogStream` (`ssr: false`) | Depends on `@microsoft/signalr` (~200 KB); browser-only WebSocket |
| `/alerts/new` | `AlertRuleBuilder` (`ssr: false`) | Multi-step form with react-hook-form + zod + FormStepper wizard |
| `/projects/new` | `NewProjectWizard` (`ssr: false`) | Same as above — log-source selector adds extra weight |

Each split component shows a `<Spinner size="lg" />` while the chunk loads.

---

## 4. Image Optimisation

| Image | Component | Changes |
|---|---|---|
| `/stacksifticon.png` (sidebar logo) | `Sidebar.tsx` | Added `priority` prop — tells Next.js to preload this above-the-fold image, removing it as an LCP candidate |
| `/namestacksifticon.png` / `/namestacksiftwhiteicon.png` (theme-aware) | `Sidebar.tsx` | Already uses `next/image`; served as AVIF/WebP via `next.config.ts` formats |

All image rendering uses `next/image` (no raw `<img>` tags). The `formats: ["image/avif", "image/webp"]` config in `next.config.ts` means modern browsers receive the smallest format automatically.

---

## 5. DataTable — 10,000-Row Smoothness

The `DataTable` component uses `@tanstack/react-virtual` (row virtualization). At any scroll position, only the **visible window** of rows (~20) is in the DOM. Total scroll height is maintained via CSS padding spacers on `<tbody>`.

### Automated test results

File: `src/app/components/ui/__tests__/DataTable.perf.test.tsx`

| Test | Result |
|---|---|
| Renders without exceeding 500 ms | PASS — 94 ms |
| Only mounts visible window DOM rows | PASS — ≤ 22 `<tr>` elements |
| Correct total scroll height for 10,000 rows | PASS — spacer height > 0 |
| Row 10,000 is NOT in the DOM | PASS |

### How to verify manually

```bash
cd src/frontend
pnpm test -- src/app/components/ui/__tests__/DataTable.perf.test.tsx
```

---

## 6. CLS Notes

Cumulative Layout Shift sources to watch:

- **Logo image** — fixed `width={32} height={32}` on the `<Image>` prevents an unsized image shift.
- **Fonts** — `Inter` and `JetBrains Mono` use `display: "swap"`. The anti-FOUC inline script (`layout.tsx`) applies the theme class before first paint, preventing a dark→light class swap that would reflow the page.
- **Sidebar collapse/expand** — width transitions are CSS transitions (`transition-colors`), not layout-triggering reflows.

---

## 7. How to Re-baseline

After significant feature work, re-run the following and update this document:

```bash
# 1. Production build
pnpm build && pnpm start

# 2. Lighthouse (key pages)
npx lighthouse http://localhost:3000       --output json --output-path ./lh-overview.json
npx lighthouse http://localhost:3000/logs  --output json --output-path ./lh-logs.json

# 3. Bundle sizes
pnpm analyze

# 4. DataTable perf tests
pnpm test -- src/app/components/ui/__tests__/DataTable.perf.test.tsx
```

Record updated scores in the table in section 2 and commit.
