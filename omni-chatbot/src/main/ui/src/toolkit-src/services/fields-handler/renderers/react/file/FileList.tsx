import React from "react";
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { readableFileSize } from "./fileUtils";
import { useRecoilValue } from "recoil";
import { configAtom } from "../../../../../../chatbot-src/atoms";
import { createMediaUrlDownload } from "../../../utils/media";

type ChildProps = {
  files: any;
  removeFile: (index?: number) => void;
  readOnly: boolean;
  isInsideTable: boolean;
  fileNameKey: string;
};

function previewFile(workspaceId:string ,fileJson: any) {
  window.open(createMediaUrlDownload(workspaceId, fileJson["mediaId"]));
}

export function FileList({
  files,
  removeFile,
  readOnly,
  fileNameKey,
  isInsideTable,
}: ChildProps) {
const chatbotConfig = useRecoilValue(configAtom);
  return (
    <List
      dense
      sx={{
        maxHeight: isInsideTable ? "none" : "10rem",
        flex: "1 0",
        overflow: "auto",
        padding: 0,
      }}
    >
      {files.map((fileJson: any, index: number) => {
        const fileName = fileJson ? fileJson[fileNameKey] : "";
        return (
          <ListItem
            key={fileJson["mediaId"]}
            secondaryAction={
              readOnly ? (
                <IconButton
                  edge="end"
                  aria-label="download file"
                  size="small"
                  color="inherit"
                  onClick={() => previewFile(chatbotConfig.workspaceId, fileJson)}
                >
                  <DownloadIcon fontSize="inherit" />
                </IconButton>
              ) : (
                <IconButton
                  edge="end"
                  aria-label="delete file"
                  size="small"
                  onClick={() => removeFile(index)}
                >
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              )
            }
            disablePadding
            sx={{
              my: 0.5,
              ".MuiListItemSecondaryAction-root": {
                right: "8px",
              },
            }}
          >
            <ListItemButton
              sx={{
                padding: "4px 40px 4px 8px !important",
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: "divider",
                borderRadius: "4px",
              }}
              onClick={() => previewFile(chatbotConfig.workspaceId, fileJson)}
            >
              <ListItemText
                primary={
                  <Typography component="div" sx={{ wordBreak: "break-word" }}>
                    {fileName}
                  </Typography>
                }
                secondary={readableFileSize(fileJson.length)}
                sx={{ my: 0 }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
