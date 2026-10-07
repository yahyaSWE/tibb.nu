import { ImageResponse } from "next/og";

export const alt = "Tibb.nu – traditionell kinesisk medicin i Jönköping";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#35584c", color: "#f8f5ed", padding: "74px 82px", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <svg width="58" height="66" viewBox="0 0 58 66" fill="none">
          <path d="M13 62L43 7" stroke="#e9bd9c" strokeWidth="3" />
          <path d="M28 42C10 47 5 34 6 23c17 0 25 6 22 19ZM39 23C26 13 31 5 43 1c8 13 4 19-4 22ZM23 50c18-14 29-9 32 3-15 10-27 9-32-3Z" fill="#e9bd9c" />
        </svg>
        <div style={{ fontSize: 54 }}>Tibb.nu</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 63, lineHeight: 1.1, maxWidth: 1000 }}>Traditionell kinesisk medicin</div>
        <div style={{ fontSize: 33, color: "#e9bd9c" }}>I ljuset av den Profetiska vägledningen</div>
      </div>
      <div style={{ display: "flex", fontSize: 25, borderTop: "1px solid #769389", paddingTop: 27, justifyContent: "space-between" }}>
        <div>Behandlingar · Kurser · Artiklar</div><div>Jönköping</div>
      </div>
    </div>, size,
  );
}
