import React, { useEffect, useRef, useState } from "react";
import { CancelTokenSource } from "axios";
import CloseIcon from "@mui/icons-material/Close";
import {Box, ListItemButton} from "@mui/material";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import { SelectChangeEvent } from "@mui/material/Select";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import List from "@mui/material/List";
import ListItemIcon from "@mui/material/ListItemIcon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { useTranslation } from "react-i18next";
import {
  EntitySearchFilter,
  EntitySelectorMeta,
} from "../../../classes/entity/EntitySelectorMeta";
import { EntitySearchBar } from "./EntitySearchBar";
import { ButtonStyled } from "../components/ButtonStyled";
import { EntitySearchPagination } from "./EntitySearchPagination";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { EntitySearchDto } from "./EntitySearchDto";
import { loadEntities } from "../../../../../api/loadEntities";
import { KSDKFormField } from "../../../../messaging";
import { IEntitySearchResult } from "./EntitySearchResult";
import { EntitySearchResultProps } from "../../../../../api/types";
import { consoleLog } from "../../../../../common/utils";

type SelectedItem = IEntitySearchResult;

interface Props {
  entitySelectorMeta: EntitySelectorMeta;
  onClose: () => void;
  onSelect: (selection?: SelectedItem[]) => void;
  field: KSDKFormField;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
}

export type EntitySearchValue = { value: any; payload: string } | null;

const PAGE_SIZE = 10;

export const EntitySearchModal = ({
  entitySelectorMeta,
  onClose,
  onSelect,
  field,
  getEntities,
}: Props) => {
  const isMounted = useRef(true);
  const [searchValue, setSearchValue] = useState<EntitySearchValue>(null);
  const [authDetails, setAuthDetails] = useState<
    { invokerName: string; authUrl: string } | undefined
  >(undefined);
  const [searchResult, setSearchResult] = useState<SelectedItem[]>([]);
  const [selectionMap, setSelectionMap] = useState<Map<string, SelectedItem>>(
    new Map()
  );
  const [searchStatus, setSearchStatus] = useState<
    "loading" | "auth" | "done" | "error" | "none"
  >("none");
  const [pageIndex, setPageIndex] = useState<number>(1);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const cancelTokenSource = useRef<CancelTokenSource>();
  const [selectedFilter, setSelectedFilter] = useState<
    EntitySearchFilter | undefined
  >(() => entitySelectorMeta.getFirstFilter());
  const { t } = useTranslation();

  useEffect(() => {
    if (entitySelectorMeta.allowDefaultSearch) {
      fetchEntities(1, true);
    }
    return () => {
      isMounted.current = false;
      cancelTokenSource.current?.cancel();
    };
  }, []);

  const resetState = () => {
    setHasPrevPage(false);
    setHasPrevPage(false);
    setPageIndex(1);
    setSearchResult([]);
    setSelectionMap(new Map());
  };

  const handleSearch = () => {
    resetState();
    setTimeout(() => {
      fetchEntities(pageIndex);
    });
  };

  const handleFilterChange = (event: SelectChangeEvent) => {
    setSearchValue(null);
    const selectedLabel = event.target.value as string;
    setSelectedFilter(
      entitySelectorMeta.availableFilters.find(
        (filter) => filter.field.name === selectedLabel
      )
    );
  };

  const selectAndClose = (selection?: SelectedItem[]) => {
    onSelect(selection);
    onClose();
  };

  function fetchEntities(page: number, isDefaultSearch = false) {
    setSearchStatus("loading");
    setAuthDetails(undefined);
    cancelTokenSource.current?.cancel();

    let filterFieldName = "";
    if (!isDefaultSearch && selectedFilter) {
      filterFieldName = selectedFilter.field.name;
    }
    let axiosPromise: Promise<EntitySearchResultProps>;
    const searchRequest = new EntitySearchDto(
      field,
      filterFieldName,
      searchValue ? searchValue.payload || "" : "",
      page,
      PAGE_SIZE
    );
    let timeout: number | undefined = undefined;
    if (isDefaultSearch) {
      timeout = entitySelectorMeta?.defaultSearchTimeout;
    } else if (selectedFilter) {
      timeout = selectedFilter.timeout;
    }
    const ajax = getEntities
      ? getEntities({
          payload: searchRequest,
          timeout,
        })
      : loadEntities({
          payload: searchRequest,
          timeout,
        });
    cancelTokenSource.current = ajax.cancelToken;
    axiosPromise = ajax.axiosPromise;
    // Promise.resolve(dummy)
    axiosPromise
      .then((response) => {
        if (!isMounted.current) return;
        try {
          if (response.status === "authentication") {
            const authentication = response.data;
            setAuthDetails({
              invokerName: authentication["invokerName"],
              authUrl: authentication["authUrl"],
            });
            setSearchStatus("auth");
          } else if (response.status === "success") {
            const entities = response.data?.entities;
            setSearchResult(entities);
            setPageIndex(page);
            setHasPrevPage(page > 1);
            setHasNextPage(!(entities.length < PAGE_SIZE));
            setSearchStatus("done");
          } else if (response.status === "error") {
            setPageIndex(page);
            setSearchResult([]);
            setHasPrevPage(page > 1);
            setHasNextPage(false);
            setSearchStatus("done");
          }
        } catch (err) {
          setSearchStatus("error");
          consoleLog(err);
        }
      })
      .catch((err) => {
        setSearchStatus("error");
        consoleLog(err);
      });
  }

  const handleSelectionChange = (entity: SelectedItem) => {
    const primaryKey = entity.value.meta.primaryKey;
    if (entitySelectorMeta.isMultiSelect) {
      setSelectionMap((map) => {
        const newSelectionMap = new Map(map);
        if (primaryKey) {
          if (newSelectionMap.has(primaryKey)) {
            newSelectionMap.delete(primaryKey);
          } else {
            newSelectionMap.set(primaryKey, entity);
          }
        }
        return newSelectionMap;
      });
    } else {
      selectAndClose([entity]);
    }
  };

  function selectAll() {
    if (searchResult.length > 0) {
      const newSelectionMap = new Map(selectionMap);
      for (const suggestion of searchResult) {
        const primaryKey = suggestion.value.meta.primaryKey;
        if (primaryKey && !newSelectionMap.has(primaryKey)) {
          newSelectionMap.set(primaryKey, suggestion);
        }
      }
      setSelectionMap(newSelectionMap);
    }
  }

  return (
    <Dialog
      open
      fullWidth={true}
      maxWidth={"md"}
      sx={{
        "& .MuiDialog-paper": {
          height: "90%",
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, pr: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          {t("krista.general.search")}
          <IconButton aria-label="close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <EntitySearchBar
          entitySelectorMeta={entitySelectorMeta}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
          onSearchValueChange={setSearchValue}
          searchValue={searchValue}
          onSearch={handleSearch}
          resetValue={() => {
            setSearchValue(null);
          }}
        />
        <React.Fragment key="loading">
          {searchStatus === "loading" ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : null}
        </React.Fragment>
        <React.Fragment key="no-results">
          {searchStatus === "done" && searchResult.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography>{t("krista.general.noResults")}</Typography>
            </Box>
          ) : null}
        </React.Fragment>
        <React.Fragment key="auth">
          {searchStatus === "auth" ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography component="div" sx={{ my: 2 }}>
                {t("krista.entity.authRequired")}
              </Typography>
              <ButtonStyled
                variant="outlined"
                onClick={() => {
                  if (authDetails) {
                    authenticateUser(authDetails.authUrl);
                  }
                }}
              >
                {t("krista.entity.authenticate")}
              </ButtonStyled>
              <Typography component="div" sx={{ my: 2 }}>
                {t("krista.entity.searchAgainAfterAuth")}
              </Typography>
            </Box>
          ) : null}
        </React.Fragment>
        <React.Fragment key="results">
          {searchStatus === "done" && searchResult.length > 0 ? (
            <Box
              sx={{
                flex: "1 0",
                overflow: "hidden",
                my: 2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {entitySelectorMeta.isMultiSelect && (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Tooltip
                    title={t("krista.entity.selectAllHelpText")}
                    placement="top"
                    arrow
                  >
                    <ButtonStyled variant="outlined" onClick={selectAll}>
                      {t("krista.general.selectAll")}
                    </ButtonStyled>
                  </Tooltip>
                  {selectionMap.size > 0 ? (
                    <Typography sx={{ ml: 2 }}>
                      {t("krista.entity.selected")}: {selectionMap.size}
                    </Typography>
                  ) : null}
                </Box>
              )}
              <Box sx={{ my: 1, overflow: "auto" }}>
                <List sx={{ p: 0 }}>
                  {searchResult.map((entity, index) => {
                    const primaryKey = entity.value.meta.primaryKey;
                    return (
                      <ListItemButton
                        divider
                        key={index}
                        onClick={() => {
                          handleSelectionChange(entity);
                        }}
                      >
                        {entitySelectorMeta.isMultiSelect && (
                          <ListItemIcon
                            sx={{
                              minWidth: "24px",
                              marginRight: "16px",
                            }}
                          >
                            <Checkbox
                              edge="start"
                              disableRipple
                              size="small"
                              checked={Boolean(
                                primaryKey && selectionMap?.has(primaryKey)
                              )}
                              sx={{
                                marginLeft: 0,
                                padding: 0,
                              }}
                            ></Checkbox>
                          </ListItemIcon>
                        )}
                        <Box
                          sx={{
                            overflow: "auto",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entity.fields.map((fs) => {
                            const Renderer =
                              FieldsHandlerService.getFieldRenderer(
                                fs,
                                "react"
                              );
                            return (
                              <Box
                                sx={{
                                  ml: 2,
                                  display: "inline-block",
                                  verticalAlign: "top",
                                }}
                                key={fs.fieldId}
                                style={{
                                  width: fs.isComplex()
                                    ? "auto"
                                    : fs.attributes.visualWidthPx,
                                }}
                              >
                                {Renderer ? <Renderer kristaTypeField={fs} /> : null}
                              </Box>
                            );
                          })}
                        </Box>
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            </Box>
          ) : null}
        </React.Fragment>
        <React.Fragment key="error">
          {searchStatus === "error" ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography>{t("krista.general.defaultErrorMessage")}</Typography>
            </Box>
          ) : null}
        </React.Fragment>
        <React.Fragment key="pagination">
          {hasPrevPage || hasNextPage ? (
            <EntitySearchPagination
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              pageIndex={pageIndex}
              onSearch={fetchEntities}
            />
          ) : null}
        </React.Fragment>
      </DialogContent>
      {entitySelectorMeta.isMultiSelect ? (
        <DialogActions sx={{ p: 2 }}>
          <Stack direction="row" sx={{ width: "100%" }}>
            <ButtonStyled
              variant="outlined"
              disabled={selectionMap.size === 0}
              onClick={() => {
                setSelectionMap(new Map());
              }}
            >
              {t("krista.general.clear")}
            </ButtonStyled>
            <div style={{ flex: "1 0 0" }} />
            <ButtonStyled
              variant="outlined"
              onClick={() => {
                setSelectionMap(new Map());
                onClose();
              }}
            >
              {t("krista.general.cancel")}
            </ButtonStyled>

            <ButtonStyled
              variant="outlined"
              sx={{ ml: 2 }}
              disabled={selectionMap.size === 0}
              onClick={() => {
                const selectionArray: SelectedItem[] = [];
                selectionMap.forEach((entity) => {
                  selectionArray.push(entity);
                });
                selectAndClose(selectionArray);
              }}
            >
              {t("krista.general.save")}
            </ButtonStyled>
          </Stack>
        </DialogActions>
      ) : null}
    </Dialog>
  );
};

function authenticateUser(authUrl: string) {
  const width = window.screen.height * 0.6;
  const height = window.screen.height * 0.6;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  window.open(
    authUrl,
    "popup",
    "width=" +
      width +
      ",height=" +
      height +
      ",menubar=0, top=" +
      top +
      ", left=" +
      left
  );
}
