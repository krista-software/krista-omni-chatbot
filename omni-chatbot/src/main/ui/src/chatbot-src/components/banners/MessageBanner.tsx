import Typography from "@mui/material/Typography";
import "./MessageBanner.css";

export const MessageBanner = (props: { children: any }) => {
  return (
    <div className="message-banner">
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ letterSpacing: "initial" }}
      >
        {props.children}
      </Typography>
    </div>
  );
};
