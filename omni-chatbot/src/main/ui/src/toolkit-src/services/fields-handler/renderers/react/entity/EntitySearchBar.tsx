import React from "react";
import Paper from "@mui/material/Paper";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputBase from "@mui/material/InputBase";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import {
  EntitySearchFilter,
  EntitySelectorMeta,
} from "../../../classes/entity/EntitySelectorMeta";
import { EntitySearchDateFilter } from "./EntitySearchDateFilter";
import { EntitySearchDateRangeFilter } from "./EntitySearchDateRangeFilter";
import { EntitySearchValue } from "./EntitySearchModal";
import { isDateFilter, isDateRangeFilter } from "../../../utils/fields";

interface EntitySearchBarProps {
  entitySelectorMeta: EntitySelectorMeta;
  onFilterChange: (event: SelectChangeEvent) => void;
  selectedFilter: EntitySearchFilter | undefined;
  onSearchValueChange: (val: EntitySearchValue) => void;
  searchValue: EntitySearchValue;
  onSearch: () => void;
  resetValue: () => void;
}

export const EntitySearchBar = ({
  onSearch,
  searchValue,
  onSearchValueChange,
  entitySelectorMeta,
  onFilterChange,
  selectedFilter,
  resetValue,
}: EntitySearchBarProps) => {
  const { t } = useTranslation();
  const _isDateFilter = selectedFilter && isDateFilter(selectedFilter);
  const _isDateRangeFilter =
    selectedFilter && isDateRangeFilter(selectedFilter);

  return (
    <Paper
      sx={{
        display: "flex",
        alignItems: "center",
      }}
    >
      {entitySelectorMeta.hasFilter() ? (
        <React.Fragment>
          <FormControl
            sx={{
              maxWidth: "35%",
              minWidth: "25%",
              ml: 1.5,
              ".MuiInput-root": {
                fontSize: "0.875rem",
              },
            }}
          >
            <Select
              variant="standard"
              onChange={(event) => {
                onFilterChange(event);
              }}
              value={selectedFilter?.field.name}
              disableUnderline={true}
            >
              {entitySelectorMeta.availableFilters.map((filter) => {
                return (
                  <MenuItem
                    sx={{ fontSize: "0.875rem" }}
                    key={filter.field.name}
                    value={filter.field.name}
                  >
                    {filter.field.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <Divider
            sx={{
              height: "28px",
              margin: "4px",
            }}
            orientation="vertical"
          />
        </React.Fragment>
      ) : null}
      <React.Fragment>
        {_isDateFilter && (
          <EntitySearchDateFilter
            value={searchValue ? searchValue.value : null}
            onChange={(newValue) => {
              onSearchValueChange(newValue);
            }}
          />
        )}

        {_isDateRangeFilter && (
          <EntitySearchDateRangeFilter
            value={searchValue ? searchValue.value : null}
            onChange={(newValue) => {
              onSearchValueChange(newValue);
            }}
          />
        )}

        {(!selectedFilter || (!_isDateFilter && !_isDateRangeFilter)) && (
          <InputBase
            value={searchValue ? searchValue.value : ""}
            onChange={(event) => {
              onSearchValueChange({
                value: event.target.value,
                payload: event.target.value,
              });
            }}
            autoFocus
            onKeyPress={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
            sx={{
              ml: 1,
              flex: 1,
              fontSize: "0.875rem",
            }}
            placeholder={t("krista.general.search")}
          />
        )}
      </React.Fragment>
      <React.Fragment key="reset">
        {searchValue ? (
          <IconButton
            type={"button"}
            sx={{
              p: 1,
              marginLeft: "auto",
            }}
            aria-label="clear"
            onClick={() => resetValue()}
            size="small"
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        ) : null}
      </React.Fragment>
      <IconButton
        type={"button"}
        sx={{
          p: 1,
          marginLeft: "auto",
        }}
        aria-label="search"
        onClick={onSearch}
        size="small"
      >
        <SearchIcon fontSize="inherit" />
      </IconButton>
    </Paper>
  );
};
