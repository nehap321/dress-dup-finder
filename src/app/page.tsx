import { Finder } from "@/components/Finder";

export default function HomePage() {
  return (
    <main className="app">
      <header>
        <p className="eyebrow">Dress Dup</p>
        <h1>The same dress, for less.</h1>
        <p className="lede">
          Paste a dress link. Dress Dup reads the product photo and looks for other dresses with a
          similar shape, neckline, sleeve, slit, or pattern. Size, color, and max price narrow that
          visual match. The brand name is not the search.
        </p>
      </header>
      <Finder />
      <footer className="foot">
        <p>
          Personal shopping helper. No account, no checkout, and no invented listings. A word search
          on Depop stays tucked away as a last resort.
        </p>
      </footer>
    </main>
  );
}
