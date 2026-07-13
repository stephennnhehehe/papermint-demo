import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: "PaperMintSans",
    fonts: [
      {
        src: "/fonts/NotoSansCJKsc-Regular.otf",
        fontWeight: 400
      },
      {
        src: "/fonts/NotoSansCJKsc-Bold.otf",
        fontWeight: 700
      }
    ]
  });
  registered = true;
}
