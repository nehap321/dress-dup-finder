import { Finder } from "@/components/Finder";

export default function HomePage() {
  return (
    <main className="app">
      <header>
        <p className="eyebrow">Dress Dup</p>
        <h1>The same dress, for less.</h1>
        <p className="lede">
          Paste a dress link and Dress Dup reads the color from that page, then looks for listings
          that show the same dress and a price. Or describe the dress in words, like blue mini
          dress, and search Depop, Poshmark, and eBay. The brand name is not the search.
        </p>
      </header>
      <Finder />
      <footer className="foot">
        <p>
          Personal shopping helper. No account, no checkout, and no invented listings. A card needs
          the listing&apos;s own photo and its price.
        </p>
      </footer>
    </main>
  );
}
