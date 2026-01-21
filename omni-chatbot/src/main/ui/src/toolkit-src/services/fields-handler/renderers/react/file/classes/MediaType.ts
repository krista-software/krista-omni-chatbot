export enum MediaType {
  audio,
  video,
  image,
  voice,
  profile,
  thumbnail, // thumbnail's are created on demand from profile images - they are not uploaded
  binary, // for any documents other than listed
  sticker,
  icon,
  excel,
  word,
  pdf,
  postView, // post view is a image of post to be embedded in iMessage, FB post, email etc
  jar, // extension jar is the file containing executable code for extension
  etl, // etl files
  csv,
}
