import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { SubmitType } from "../../../toolkit-src";

export function MessagePaths({
  paths,
  onClick,
  submittedPath,
}: {
  submittedPath?: string;
  paths: string[];
  onClick: (type: SubmitType.path, path: string) => void;
}) {
  return (
    <Stack
      sx={{
        flexDirection: "row",
        flexWrap: "wrap",
        maxWidth: "100%",
        gap: "5px",
      }}
    >
      {paths.map((path: string) => (
        <Button
          key={path}
          onClick={() => {
            if (!submittedPath) {
              onClick(SubmitType.path, path);
            }
          }}
          disabled={!!submittedPath}
          size="small"
          variant="outlined"
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider} !important`,
            color: (theme) => `${theme.palette.text.primary} !important`,
            fontWeight: 400,
            opacity: !submittedPath || submittedPath === path ? 1 : 0.4,
          }}
        >
          {path}
        </Button>
      ))}
    </Stack>
  );
}
