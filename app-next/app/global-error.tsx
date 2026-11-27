"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0b1a14",
          color: "#f4f1e4",
          fontFamily: "Helvetica, Arial, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            padding: "2rem",
            border: "1px solid #c9a96a",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <p
            style={{
              color: "#c9a96a",
              letterSpacing: "0.4em",
              fontSize: 12,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Root error
          </p>
          <h1 style={{ fontSize: 28, margin: "0.5rem 0 1rem" }}>
            Something broke before the layout could render.
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#0b1a14",
              border: "1px solid #333",
              padding: "1rem",
              fontSize: 13,
              color: "#f4f1e4",
            }}
          >
            {error.message || String(error)}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              background: "#c9a96a",
              color: "#0b1a14",
              border: 0,
              padding: "0.75rem 1.5rem",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
