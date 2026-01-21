import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { SubmitType } from "../../../toolkit-src";

export function MessageSidebars({
  sidebars,
  onClick,
  readOnly,
}: {
  readOnly: boolean;
  sidebars: string[];
  onClick: (type: SubmitType.sidebar, sidebar: string) => void;
}) {
  return (
    <Stack
      sx={{
        flexDirection: "row",
        flexWrap: "wrap",
        maxWidth: "100%",
        gap: "5px",
        marginTop: "6px",
      }}
    >
      {sidebars.map((sidebar: string) => (
        <Button
          key={sidebar}
          onClick={() => onClick(SubmitType.sidebar, sidebar)}
          disabled={readOnly}
          size="small"
          variant="outlined"
          sx={{
            borderColor: "divider",
            color: "text.primary",
            backgroundColor: "#fff",
            fontWeight: 400,
          }}
        >
          {sidebar}
        </Button>
      ))}
    </Stack>
  );
}
