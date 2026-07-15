import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: "PaperMintSans",
    fonts: [
      {
        src: "/fonts/NotoSansSC-Regular.ttf",
        fontWeight: 400
      },
      {
        src: "/fonts/NotoSansSC-Bold.ttf",
        fontWeight: 700
      }
    ]
  });
  registered = true;
}
