/**
 * Root layout — required by Next.js App Router.
 *
 * In a next-intl setup this file must NOT render `<html>` itself: the
 * `[locale]/layout.tsx` is the one that owns the document because it needs
 * locale-aware attributes (lang + dir).
 *
 * Returning children untouched here is the recommended pattern.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export const metadata = {
  title: 'Empire Shop',
  description: 'Empire Shop foundation',
};
