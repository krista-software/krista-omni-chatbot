import { MediaMeta } from "./MediaMeta";

export class ImageProcessor {
  static createBlurThumbnail(src: string, callBack: (meta: MediaMeta) => void) {
    const width = 64;
    const img = new Image();
    img.crossOrigin = "anonymous";
    // tslint:disable-next-line:only-arrow-functions
    img.onload = function () {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const height = (width / imgWidth) * imgHeight;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx!.filter = "blur(2px)";
      ctx!.drawImage(img, 0, 0, width, height);

      let dataUrl = canvas.toDataURL("image/jpeg");
      dataUrl = dataUrl.replace(/^data:image.+;base64,/, "");

      const meta = new MediaMeta(imgWidth, imgHeight, dataUrl, 0);
      callBack(meta);
    };
    img.src = src;
  }

  static createBlurThumbnailFromVideo(
    src: string,
    callBack: (meta: MediaMeta) => void
  ) {
    const width = 64;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    // tslint:disable-next-line:only-arrow-functions
    video.onloadedmetadata = function () {
      video.currentTime = Math.max(3, Math.ceil(video.duration / 3));
    };

    // tslint:disable-next-line:only-arrow-functions
    video.ontimeupdate = function () {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const height = (width / videoWidth) * videoHeight;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx!.filter = "blur(2px)";
      ctx!.drawImage(video, 0, 0, width, height);

      let dataUrl = canvas.toDataURL("image/jpeg");
      dataUrl = dataUrl.replace(/^data:image.+;base64,/, "");

      const meta = new MediaMeta(
        videoWidth,
        videoHeight,
        dataUrl,
        video.duration
      );
      callBack(meta);
    };
    video.src = src;
  }
}
