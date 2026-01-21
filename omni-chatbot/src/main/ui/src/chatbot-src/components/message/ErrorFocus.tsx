import { useEffect } from "react";

interface ErrorFocusProps {
  executionId: string;
  errorFields: string[];
}

export function ErrorFocus(props: ErrorFocusProps) {
  const { executionId, errorFields } = props;
  useEffect(() => {
    if (errorFields && errorFields.length > 0) {
      const element = document.getElementById(
        `${executionId}_${errorFields[0].replace(/ /g, "_")}`
      );
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "start",
        });
      }
    }
  }, [executionId, errorFields]);
  return null;
}
