import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

const fileSizes = {
  kb: 1024,
  mb: 1024 * 1024,
};

export class FileFieldAttributes extends KristaFieldAttributes {
  public static readonly FILE_TYPES = "fileTypes"; // string[]
  public static readonly EXCLUDED_FILE_EXTENSIONS = "excludedFileExtensions"; // string[]
  public static readonly MIN_FILE_SIZE = "minFileSize"; // string
  public static readonly MIN_FILE_SIZE_UNIT = "minFileSizeUnit"; // string
  public static readonly MAX_FILE_SIZE = "maxFileSize"; // string
  public static readonly MAX_FILE_SIZE_UNIT = "maxFileSizeUnit"; // string
  public static readonly MULTIPLE_FILE_UPLOAD = "multipleFileUpload"; // boolean

  protected _file_types: string[];
  protected readonly _excluded_file_extensions: string[];
  private readonly _min_file_size: string;
  private readonly _min_file_size_unit: string;
  private readonly _max_file_size: string;
  private readonly _max_file_size_unit: string;
  protected readonly _multiple_file_upload: boolean;

  public readonly minFileSize = Number.NEGATIVE_INFINITY;
  public readonly maxFileSize = Number.POSITIVE_INFINITY;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._file_types = attributes.get(FileFieldAttributes.FILE_TYPES) || [];
    this._excluded_file_extensions =
      attributes.get(FileFieldAttributes.EXCLUDED_FILE_EXTENSIONS) || [];
    this._min_file_size = attributes.get(FileFieldAttributes.MIN_FILE_SIZE);
    this._min_file_size_unit = attributes.get(
      FileFieldAttributes.MIN_FILE_SIZE_UNIT
    );
    this._max_file_size = attributes.get(FileFieldAttributes.MAX_FILE_SIZE);
    this._max_file_size_unit = attributes.get(
      FileFieldAttributes.MAX_FILE_SIZE_UNIT
    );
    this._multiple_file_upload = attributes.get(
      FileFieldAttributes.MULTIPLE_FILE_UPLOAD
    );

    this._excluded_file_extensions = this._excluded_file_extensions.map((f) =>
      f.toLowerCase()
    );

    if (this._min_file_size && !Number.isNaN(+this._min_file_size)) {
      this.minFileSize =
        +this._min_file_size *
        fileSizes[
          this._min_file_size_unit.toLowerCase() as keyof typeof fileSizes
        ];
    }
    if (this._max_file_size && !Number.isNaN(+this._max_file_size)) {
      this.maxFileSize =
        +this._max_file_size *
        fileSizes[
          this._max_file_size_unit.toLowerCase() as keyof typeof fileSizes
        ];
    }
  }

  get fileTypes(): string[] {
    return isDefined(this._file_types) ? this._file_types : [];
  }

  set fileTypes(types: string[]) {
    this._file_types = types;
  }

  get excludedFileExtensions(): string[] {
    return isDefined(this._excluded_file_extensions)
      ? this._excluded_file_extensions
      : [];
  }

  get multipleFileUpload(): boolean {
    return isDefined(this._multiple_file_upload)
      ? this._multiple_file_upload
      : false;
  }
}
