import { Font } from "@react-pdf/renderer";

let registered = false;

function fontSource(fileName: string) {
  return typeof window === "undefined"
    ? `${process.cwd()}/public/fonts/${fileName}`
    : `/fonts/${fileName}`;
}

export function registerPdfFonts() {
  if (registered) return;
  Font.register({
    family: "PaperMintSans",
    fonts: [
      {
        src: fontSource("NotoSansSC-Regular.ttf"),
        fontWeight: 400
      },
      {
        src: fontSource("NotoSansSC-Bold.ttf"),
        fontWeight: 700
      }
    ]
  });
  Font.register({
    family: "PaperMintArabic",
    fonts: [
      {
        src: fontSource("NotoSansArabic-Regular.ttf"),
        fontWeight: 400
      },
      {
        src: fontSource("NotoSansArabic-Bold.ttf"),
        fontWeight: 700
      }
    ]
  });
  registered = true;
}
