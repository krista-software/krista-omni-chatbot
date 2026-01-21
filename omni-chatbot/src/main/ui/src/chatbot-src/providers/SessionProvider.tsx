import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { CircularProgress, Typography } from "@mui/material";
import { sessionIdAtom } from "../atoms";
import { useGetSession } from "../server/api/useGetSession";
import { LoaderContainer } from "../components/shared/LoaderContainer";

export function SessionProvider({ children }: { children: JSX.Element }) {
  const [sessionId, setSessionId] = useRecoilState(sessionIdAtom);
  const { inbox, loading, error } = useGetSession();

  useEffect(() => {
    if (!loading && inbox) {
      setSessionId(inbox);
    }
  }, [inbox, loading, setSessionId]);

  if (loading) {
    return (
      <LoaderContainer>
        <CircularProgress />
      </LoaderContainer>
    );
  }

  if (error) {
    return (
      <LoaderContainer>
        <Typography>{error}</Typography>
      </LoaderContainer>
    );
  }

  if (sessionId) {
    return children;
  }

  return null;
}
