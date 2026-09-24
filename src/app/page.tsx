import { Finder } from "@/components/Finder";

export default function HomePage() {
  return (
    <main className="app">
      <header>
        <p className="eyebrow">Dress Dup</p>
        <h1>The same dress, for less.</h1>
        <p className="lede">
          Paste a link from Windsor, Princess Polly, or another brand. Add your size, a color, and
          the most you&apos;ll pay. Dress Dup reads the product page and looks for secondhand Depop
          listings.
        </p>
      </header>
      <Finder />
      <footer className="foot">
        <p>
          Personal shopping helper. No account, no checkout, and no invented listings. Depop opens
          in a new tab when their site blocks a server search.
        </p>
      </footer>
    </main>
  );
}
