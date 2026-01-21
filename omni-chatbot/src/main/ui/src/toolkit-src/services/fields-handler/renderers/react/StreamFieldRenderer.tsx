import React, {useEffect, useRef, useState} from "react";
import {ReactFieldRenderer} from "../types";
import {Priorities} from "../../Priorities";
import {FieldTypes, KristaFieldAttributes, KristaTypeField, KristaValue, StreamField} from "../../state-managers";
import {MessageType} from "../../../messaging";
import {Typography} from "@mui/material";
import {ReadOnlyFieldContent} from "./components/ReadOnlyFieldContent.tsx";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import {PauseCircle, PlayCircle} from "@mui/icons-material";
import Tooltip from "@mui/material/Tooltip";
import {useTranslation} from "react-i18next";
import {StreamCallback, StreamProvider} from "@krista/field-types/core/services/stream/StreamProvider";
import {PrefStorage} from "../../../../../chatbot-src/modules/storage/PrefStorage.ts";
import {StreamEventTypes} from "@krista/field-types/core/services/stream/StreamEventExecutor";
import {StreamCacheObject} from "@krista/field-types/core/services/stream/StreamCacheObject";
import {ToolkitConfig} from "../../../../ToolkitConfig";
import BlinkingDot from "../../../../../chatbot-src/components/shared/BlinkingDot.tsx";

export const StreamFieldRenderer = (({kristaTypeField, options = {}}) => {

  const config = ToolkitConfig.getInstance().getConfig();
  const workspaceId = config?.workspaceId || "";
  const nodeName = config?.nodeName || "";
  const clientSessionId = PrefStorage.getClientSessionId() || config?.clientSessionId || "";

  const [streamValue] = useState(() => {
    try {
      return (kristaTypeField as StreamField).getKristaValue().getValue();
    } catch (e) {
      console.error("Error getting stream value:", e);
      return null;
    }
  });
  const streamProviderRef = useRef<StreamProvider>(StreamProvider.getInstance(workspaceId, nodeName, clientSessionId));

  const [updatedTime, setUpdatedTime] = useState(0);
  const streamProvider = streamProviderRef.current;
  const {t} = useTranslation();
  const isMounted = useRef(true);

  // Typing animation state
  const [displayedStreamContent, setDisplayedStreamContent] = useState<string>("");
  const typedContentRef = useRef("");
  const typingQueueRef = useRef<string>("");
  const typingIntervalRef = useRef<number | undefined>(undefined);

  // Typing animation functions
  const handleStreamTextChunk = (fullText: string) => {
    const alreadyDisplayed = typedContentRef.current + typingQueueRef.current;
    const newPart = fullText.slice(alreadyDisplayed.length);
    typingQueueRef.current += newPart;
  };

  const startTyping = () => {
    if (typingIntervalRef.current) return;

    typingIntervalRef.current = setInterval(() => {
      if (typingQueueRef.current.length > 0) {
        const charsToProcess = Math.min(
          Math.max(1, Math.floor(typingQueueRef.current.length / 50)),
          5
        );
        const chunk = typingQueueRef.current.slice(0, charsToProcess);
        typingQueueRef.current = typingQueueRef.current.slice(charsToProcess);

        typedContentRef.current += chunk;
        setDisplayedStreamContent(typedContentRef.current);

      } else if (streamProvider.isCompleted(streamValue?.streamId)) {
        clearTypeInterval();
      }
    }, 10);
  };

  const clearTypeInterval = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current!);
      typingIntervalRef.current = undefined;
    }
  };

  let streamCallback: StreamCallback;

  useEffect(() => {
    // Only start streaming if we have a valid streamValue and provider
    if (streamValue?.streamId && streamProvider && !streamProvider.isStreamCancelled(streamValue.streamId)) {
      prepareStreaming();
    }

    return () => {
      isMounted.current = false;
      clearTypeInterval();
    };
  }, []);

  function prepareStreaming(): void {
    if (!(streamValue && streamValue.streamId)) {
      return;
    }

    const cacheObject = streamProvider.getCacheObject(streamValue.streamId);
    const initialEvent = cacheObject?.initialStreamEvent || streamValue.firstEvent;

    if (streamProvider.isCompleted(streamValue?.streamId)) {
      setDisplayedStreamContent(prev => prev + initialEvent?.content?.content || "");
      return;
    }

    streamCallback = (event: StreamEventTypes, streamCache?: StreamCacheObject) => {
      if (!isMounted.current) {
        return;
      }
      switch (event) {
        case "stream-event": {
          handleStreamTextChunk(streamCache?.getRealContent());
          break;
        }
        case "stream-closed":
        case "stream-error":
        case "stream-cancelled": {
          setUpdatedTime(Date.now);
          break;
        }
        case "stream-finished": {
          handleStreamTextChunk(streamCache?.getRealContent());
          break;
        }
      }
    };

    streamProvider.addOrGetStreaming(streamValue.streamId, kristaTypeField.objectId, initialEvent, streamCallback);
    handleStreamTextChunk(initialEvent?.content?.content || "");
    startTyping();
  }

  function pauseStreaming() {
    const streamId = streamValue?.streamId;
    if (streamId) {
      streamProvider.cancelTask(streamId, false);
      setUpdatedTime(Date.now);
    }
  }

  function resumeStreaming() {
    prepareStreaming();
    setUpdatedTime(Date.now);
  }

  // If we don't have a valid streamValue, show a simple message
  if (!streamValue || !streamValue.streamId) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={
          <Typography>Stream data unavailable</Typography>
        }
        title={kristaTypeField.attributes.toolTip}
      />
    );
  }

  const PauseComponent = () => (
    <Stack direction="row"
           justifyContent="space-between"
           alignItems="center"
           sx={{marginTop: "0px"}}>

      <Tooltip disableInteractive title={t("fields.stream.pauseStreaming")} arrow placement="top">
        <IconButton onClick={pauseStreaming} color="primary" size="small">
          <PauseCircle sx={{ fontSize: 20 }}/>
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const PlayComponent = () => (
    <Stack direction="row"
           justifyContent="end"
           alignItems="center"
           sx={{marginTop: "0px"}}>
      <Tooltip disableInteractive title={t("fields.stream.resumeStreaming")} arrow placement="top">
        <IconButton onClick={resumeStreaming} color="primary" size="small">
          <PlayCircle sx={{ fontSize: 20 }}/>
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <ReadOnlyFieldContent
      key={updatedTime}
      label={kristaTypeField.displayLabel}
      required={kristaTypeField.required && options.messageType !== MessageType.Inform}
      hideLabel={options.hideLabel || kristaTypeField.isInsideTable}
      content={
        <div style={{ position: 'relative', minHeight: '24px' }}>
          <Typography style={{whiteSpace: 'normal'}}>
            <span dangerouslySetInnerHTML={{__html: displayedStreamContent || "" }} />
            {(streamProvider.isStreamInQueue(streamValue.streamId) && !streamProvider.isStreamCancelled(streamValue.streamId))
              ? <BlinkingDot /> : null
            }
          </Typography>

          {((streamProvider.isStreamInQueue(streamValue.streamId) && !streamProvider.isStreamCancelled(streamValue.streamId)) ||
            streamProvider.isStreamCancelled(streamValue.streamId)) && (
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              zIndex: 1
            }}>
              {(streamProvider.isStreamInQueue(streamValue.streamId) && !streamProvider.isStreamCancelled(streamValue.streamId)) ?
                <PauseComponent /> :
                <PlayComponent />
              }
            </div>
          )}
        </div>
      }
      title={kristaTypeField.attributes.toolTip}
    />
  );
}) as ReactFieldRenderer;

StreamFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.STREAM_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
