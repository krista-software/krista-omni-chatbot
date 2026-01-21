import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { CancelTokenSource } from "axios";
import { useTranslation } from "react-i18next";
import { ReactFieldRenderer } from "../../types";
import { KristaValue } from "../../../state-managers";
import { KristaTypeField } from "../../../state-managers";
import { KristaFieldAttributes } from "../../../state-managers";
import { FieldTypes } from "../../../state-managers";
import { Priorities } from "../../../Priorities";
import {
  AUDIO,
  createFromDocImage,
  fileFormats,
  IMAGE,
  isFileAllowed,
  VIDEO,
} from "./fileUtils";
import { ImageProcessor } from "./classes/ImageProcessor";
import { DocAudio } from "./classes/DocAudio";
import { FormLabel } from "../components/FormLabel";
import { FieldErrorMessage } from "../components/FieldErrorMessage";
import { FileList } from "./FileList";
import { FileField } from "../../../state-managers";
import { CameraField } from "../../../state-managers";
import { uploadMediaRequest } from "../../../../../api/uploadMediaRequest";
import { MediaMeta } from "./classes/MediaMeta";
import { DocDocument } from "./classes/DocDocument";
import { DocImage } from "./classes/DocImage";
import { DocVideo } from "./classes/DocVideo";
import { GenericObject } from "../../../state-managers";
import { isDefined } from "../../../../../common/utils";
import { useRecoilValue } from "recoil";
import { configAtom } from "../../../../../../chatbot-src/atoms";
import CryptoJS from 'crypto-js';
import i18next from "i18next";

export const FileFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const chatbotConfig = useRecoilValue(configAtom);
  const isCameraField = kristaTypeField.fieldType === FieldTypes.CAMERA_FIELD;
  let fieldState = kristaTypeField as CameraField | FileField;
  const { multiFileUpload, fileTypes, tooltip } = useMemo(() => {
    const _multipleFileUpload: boolean =
      kristaTypeField.attributes.get("multipleFileUpload") || false;
    let _fileTypes: string[] = kristaTypeField.attributes.get("fileTypes") || [];
    if (isCameraField) {
      _fileTypes = ["CameraImageOnly"];
    }
    return {
      multiFileUpload: _multipleFileUpload,
      fileTypes: _fileTypes,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const isMounted = useRef(true);
  const { t } = useTranslation();
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const cancelTokenSource = useRef<CancelTokenSource>();
  const [numberOfFiles, setNumberOfFiles] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[] | undefined>(() => {
    if (isCameraField) {
      const initialValue = (fieldState as CameraField)
        .getKristaValue()
        .getValue();
      return initialValue ? [initialValue.toJSON()] : undefined;
    }
    const initialValue = (fieldState as FileField).getKristaValue().getValue();
    return isDefined(initialValue) ? initialValue : undefined;
  });

  const onFileSelect = (event: any) => {
    const files: File[] = event.target.files;
    if (!isDefined(files) || files.length < 1) {
      return;
    }
    const _errorMessages: string[] = [];
    let _numberOfFiles = numberOfFiles;
    for (const file of files) {
      const err = isFileAllowed(
        file,
        fileTypes,
        fieldState.attributes.get("excludedFileExtensions") || [],
        fieldState.attributes.minFileSize,
        fieldState.attributes.maxFileSize
      );
      if (!err) {
        _numberOfFiles += 1;

        setUploadingFiles(true);
        fieldState.setUploadingStatus(true);
        if (!multiFileUpload) {
          clearOldSelection();
        }
        calculateMD5(file)
            .then((md5Checksum) => {
              const {cancelToken, axiosPromise} = uploadMediaRequest({
                workspaceId: chatbotConfig.workspaceId,
                file: file,
                md5Checksum: md5Checksum,
                scope: 'messages'
              });
              cancelTokenSource.current = cancelToken;
              return axiosPromise;
            })
          .then((response) => {
            const {
              data: { file, mediaId },
            } = response;
            if (isCameraField) {
              ImageProcessor.createBlurThumbnail(
                URL.createObjectURL(file),
                (blur: MediaMeta) => {
                  const doc = new DocImage(
                    mediaId,
                    file,
                    blur.width,
                    blur.height,
                    blur.blur
                  );
                  const imageInfo = createFromDocImage(doc);
                  setUploadedFiles([imageInfo.toJSON()]);
                  setNumberOfFiles(0);
                }
              );
            } else {
              const fileType = file.type.toLowerCase();
              if (fileType.startsWith(IMAGE)) {
                ImageProcessor.createBlurThumbnail(
                  URL.createObjectURL(file),
                  (blur: MediaMeta) => {
                    const doc = new DocImage(
                      mediaId,
                      file,
                      blur.width,
                      blur.height,
                      blur.blur
                    );
                    updateStateValue(doc.toAttributes());
                  }
                );
              } else if (fileType.startsWith(VIDEO)) {
                ImageProcessor.createBlurThumbnailFromVideo(
                  URL.createObjectURL(file),
                  (meta) => {
                    const doc = new DocVideo(mediaId, file, meta);
                    updateStateValue(doc.toAttributes());
                  }
                );
              } else if (fileType.startsWith(AUDIO)) {
                const doc = new DocAudio(mediaId, file, false);
                updateStateValue(doc.toAttributes());
              } else {
                const doc = new DocDocument(mediaId, file);
                updateStateValue(doc.toAttributes());
              }
            }
          })
          .catch((e) => {
            _errorMessages.push(i18next.t("general.defaultApiErrorMessage"));
            setUploadingFiles(false);
            fieldState.setUploadingStatus(false);
          });
      } else {
        _errorMessages.push(err);
      }
    }
    setNumberOfFiles(_numberOfFiles);
    setErrorMessages(_errorMessages);
  };

  const calculateMD5 = (file: File) => {
    return new Promise<string>((resolve, reject) => {
       const reader = new FileReader();
       reader.readAsArrayBuffer(file);
       reader.onload = () => {
           const wordArray = CryptoJS.lib.WordArray.create(reader.result as ArrayBuffer);
           const md5Checksum = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
           resolve(md5Checksum);
       };
       reader.onerror = error => reject(error);
      });
  }

  function clearOldSelection() {
    setUploadedFiles(undefined);
  }

  function updateStateValue(attrs: Map<string, any>) {
    const attributesJson: GenericObject = {};

    attrs.forEach((value, key) => {
      attributesJson[key] = value;
    });
    if (multiFileUpload) {
      setUploadedFiles((files) =>
        files ? [...files, attributesJson] : [attributesJson]
      );
    } else {
      setUploadedFiles([attributesJson]);
    }
    setNumberOfFiles((x) => x - 1);
  }

  function removeFile(index?: number) {
    if (isCameraField) {
      setUploadedFiles(undefined);
    } else {
      let files: any[] = uploadedFiles ? [...uploadedFiles] : [];
      if (multiFileUpload) {
        if (index !== undefined) {
          files.splice(index, 1);
        }
      } else {
        files = [];
      }

      if (files.length === 0) {
        const inputRef = fileUploadRef.current;
        if (inputRef) {
          inputRef.value = "";
        }
      }
      setUploadedFiles(files.length > 0 ? files : undefined);
    }
  }

  function openFileSelector() {
    if (fieldState.readOnly || options.readOnly || uploadingFiles) {
      return;
    }
    let acceptedFileTypes: string = fileTypes
      .map((ft: any) => {
        const format = fileFormats[ft];
        return format || "";
      })
      .join();
    if (fileTypes.includes("Document")) {
      acceptedFileTypes = fileFormats["Document"];
    }
    const inputRef = fileUploadRef.current;
    if (inputRef) {
      if (acceptedFileTypes.length > 0) {
        inputRef.accept = acceptedFileTypes;
        inputRef.click();
      } else {
        setErrorMessages([t("krista.file.atLeastOneUploadOption")]);
      }
    }
  }

  useEffect(() => {
    if (isCameraField) {
      fieldState.setValue(uploadedFiles ? uploadedFiles[0] : undefined);
    } else {
      fieldState.setValue(uploadedFiles);
    }
  }, [fieldState, uploadedFiles, isCameraField]);

  useEffect(() => {
    if (numberOfFiles === 0) {
      setUploadingFiles(false);
      fieldState.setUploadingStatus(false);
    }
  }, [numberOfFiles, fieldState]);

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      cancelTokenSource.current?.cancel();
    };
  }, []);

  return (
    <FormControl fullWidth>
      <input
        style={{ display: "none" }}
        ref={fileUploadRef}
        type="file"
        name={fieldState.displayLabel}
        multiple={multiFileUpload}
        onChange={onFileSelect}
      />

      {!fieldState.isInsideTable && (
        <FormLabel
          required={kristaTypeField.required}
          text={fieldState.displayLabel}
          title={tooltip}
        />
      )}
      {kristaTypeField.isInsideTable
        ? errorMessages.map((message) => (
            <FieldErrorMessage error={message} key={message} />
          ))
        : null}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <Stack direction="row" alignItems="flex-end">
        {!(fieldState.readOnly || options.readOnly) &&
          (!uploadedFiles || uploadedFiles.length === 0) && (
            <Typography
              component="div"
              sx={{
                fontSize: "0.875rem",
                flexGrow: 1,
                overflow: "hidden",
                whiteSpace: "nowrap",
                pb: 0.5,
                mr: 1,
                opacity: 0.4,
              }}
            >
              {fieldState.displayLabel}
            </Typography>
          )}
        {uploadedFiles && uploadedFiles.length > 0 && (
          <FileList
            isInsideTable={fieldState.isInsideTable}
            files={uploadedFiles}
            removeFile={removeFile}
            readOnly={fieldState.readOnly || !!options.readOnly}
            fileNameKey={isCameraField ? "filename" : "fileName"}
          />
        )}
        {!(fieldState.readOnly || options.readOnly) && (
          <IconButton onClick={openFileSelector} size="small">
            {uploadingFiles ? (
              <CircularProgress size={18} />
            ) : (
              <AttachFileIcon fontSize="inherit" />
            )}
          </IconButton>
        )}
      </Stack>
      {fieldState.readOnly ||
      options.readOnly ||
      fieldState.isInsideTable ? null : (
        <Divider />
      )}
      {!kristaTypeField.isInsideTable
        ? errorMessages.map((message) => (
            <FieldErrorMessage error={message} key={message} />
          ))
        : null}
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

FileFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.FILE_FIELD:
    case FieldTypes.CAMERA_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
