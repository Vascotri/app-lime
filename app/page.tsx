import { greeting } from "@/lib/greeting";

export default function Home() {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 style={{ margin: 0 }}>It works.</h1>
        <p style={{ color: "#555" }}>
          {greeting("world")} This app was scaffolded from the HQ golden path — replace this page with
          the real thing.
        </p>
      </div>
    </main>
  );
}
