import i18next from "i18next";
import { CameraFile } from "../../../state-managers/classes/CameraFile";
import { DocImage } from "./classes/DocImage";
import { MediaType } from "./classes/MediaType";

const blockedFileExtensions = [
  "ace",
  "ade",
  "adp",
  "ani",
  "app",
  "appcontent-ms",
  "appref-ms",
  "asp",
  "aspx",
  "asx",
  "bas",
  "bat",
  "cdxml",
  "cer",
  "chm",
  "cmd",
  "cnt",
  "com",
  "cpl",
  "crt",
  "csh",
  "der",
  "diagcab",
  "docm",
  "exe",
  "fxp",
  "gadget",
  "grp",
  "hlp",
  "hpj",
  "hta",
  "htc",
  "inf",
  "ins",
  "isp",
  "its",
  "jar",
  "jnlp",
  "js",
  "jse",
  "ksh",
  "lnk",
  "mad",
  "maf",
  "mag",
  "mam",
  "maq",
  "mar",
  "mas",
  "mat",
  "mau",
  "mav",
  "maw",
  "mcf",
  "mda",
  "mdb",
  "mde",
  "mdt",
  "mdw",
  "mdz",
  "mht",
  "mhtml",
  "msc",
  "msh",
  "msh1",
  "msh1xml",
  "msh2",
  "msh2xml",
  "mshxml",
  "msi",
  "msp",
  "mst",
  "msu",
  "ops",
  "osd",
  "pcd",
  "pif",
  "pl",
  "plg",
  "prf",
  "prg",
  "printerexport",
  "ps1",
  "ps1.xml",
  "ps1xml",
  "ps2",
  "ps2xml",
  "psc1",
  "psc2",
  "psd1",
  "psdm1",
  "psdm1cdxml",
  "pssc",
  "pst",
  "py",
  "pyc",
  "pyo",
  "pyw",
  "pyz",
  "pyzw",
  "reg",
  "scf",
  "scr",
  "sct",
  "settingcontent-ms",
  "shb",
  "shs",
  "theme",
  "tmp",
  "udl",
  "url",
  "vb",
  "vbe",
  "vbp",
  "vbs",
  "vsmacros",
  "vss",
  "vst",
  "vsw",
  "webpnp",
  "website",
  "ws",
  "wsb",
  "wsc",
  "wsf",
  "wsh",
  "xbap",
  "xll",
  "xml",
  "xnk",
  "svg",
  "html",
  "php5",
  "pht",
  "phtml",
  "shtml",
  "asa",
  "asax",
  "swf",
  "xap",
  "jsp"
];

export const fileFormats: any = {
  Document: "*/*",
  "Image gallery": "image/*,video/*",
  CameraImageOnly: "image/*",
  Camera: "image/*,video/*",
  Contact: ".csv,.vcf",
  Audio: "audio/*",
};

export const IMAGE = "image";
export const VIDEO = "video";
export const AUDIO = "audio";

export function isFileAllowed(
  file: File,
  fileTypes: string[],
  excludedFileExtensions: string[] = [],
  minFileSize?: number,
  maxFileSize?: number
): string {
  if (file.name) {
    let ext = file.name.split(".").pop();
    ext = ext ? ext.toLowerCase() : "";
    if (!ext) {
      return i18next.t("krista.file.unknownFormat", { filename: file.name });
    }
    if (blockedFileExtensions.includes(ext)) {
      return i18next.t("krista.file.notSupported", { filename: file.name });
    }
    if (
      excludedFileExtensions.includes("." + ext) ||
      excludedFileExtensions.includes(ext)
    ) {
      return i18next.t("krista.file.notSupported", { filename: file.name });
    }
    if (!isFileTypeValid(file, fileTypes)) {
      return i18next.t("krista.file.typeNotSupported", { filename: file.name });
    }
    if (minFileSize && file.size < minFileSize) {
      return i18next.t("krista.file.minSize", {
        filename: file.name,
        size: readableFileSize(minFileSize),
      });
    }
    if (maxFileSize && file.size > maxFileSize) {
      return i18next.t("krista.file.maxSize", {
        filename: file.name,
        size: readableFileSize(maxFileSize),
      });
    }
    return "";
  }
  return i18next.t("krista.file.unknownFileFormat");
}

export function isFileTypeValid(file: File, fileTypes: string[]) {
  const fileFormatsStartWith: any = {
    "Image gallery": ["image/", "video/"],
    CameraImageOnly: ["image/"],
    Camera: ["image/", "video/"],
    Audio: ["audio/"],
  };
  if (fileTypes.length === 0 || fileTypes.includes("Document")) {
    return true;
  } else if (fileTypes.includes("Contact")) {
    let ext = file.name.split(".").pop();
    ext = ext ? ext.toLowerCase() : "";
    if (ext === "csv" || ext === "vcf") {
      return true;
    }
  }

  let fileTypesAll = fileTypes.map((ft) => {
    // did this to satisfy Typescript
    const types = fileFormatsStartWith[ft];
    if (types !== undefined) {
      return types;
    }
    return [];
  });

  const fileTypesAllCon: string[] = ([] as string[]).concat(...fileTypesAll);
  return fileTypesAllCon.find((fI) => file.type.startsWith(fI));
}

export function getMediaTypeFromExtension(ext?: string | undefined): MediaType {
  if (!ext) {
    return MediaType.binary;
  }
  const extensionsMap: (MediaType | string[])[][] = [
    [MediaType.image, ["jpeg", "jpg", "png", "gif"]],
    [MediaType.video, ["mp4"]],
    [MediaType.audio, ["mp3"]],
    [MediaType.excel, ["xls", "xlsx"]],
    [MediaType.word, ["doc", "docx"]],
    [MediaType.pdf, ["pdf"]],
    [MediaType.jar, ["jar"]],
    [MediaType.etl, ["etl"]],
    [MediaType.csv, ["csv"]],
  ];
  const type = extensionsMap.find((e) =>
    (e[1] as string[]).includes(ext.toLowerCase())
  );
  if (type) {
    return type[0] as MediaType;
  }
  return MediaType.binary;
}

export function readableFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units: string[] = ["B", "KB", "MB", "GB", "TB"];
  const digitGroups = Math.floor(Math.log10(bytes) / Math.log10(1024));
  return (
    (bytes / Math.pow(1024, digitGroups)).toFixed(2) + " " + units[digitGroups]
  );
}

export function createFromDocImage(docImage: DocImage): CameraFile {
  return new CameraFile(
    docImage.mediaId.toString(),
    docImage.file.name,
    docImage.file.size,
    docImage.width,
    docImage.height,
    docImage.blurImageStr
  );
}
