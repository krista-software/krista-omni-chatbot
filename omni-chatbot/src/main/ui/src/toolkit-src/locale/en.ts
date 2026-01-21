export const locale_en = {
  krista: {
    general: {
      defaultErrorMessage: "Something went wrong. Please try again later.",
      ok: "Ok",
      search: "Search",
      cancel: "Cancel",
      clear: "Clear",
      remove: "Remove",
      delete: "Delete",
      save: "Save",
      noResults: "No entries found.",
      selectAll: "Select all",
      unknownField: "Unknown Field",
      enterCorrectValues: "Ensure that you enter appropriate values.",
    },
    address: {
      street: "Street",
      street2: "Street2",
      city: "City",
      state: "State",
      country: "Country",
      postalCode: "Postal Code",
    },
    table: {
      deletedRows: "Deleted Rows",
      selectedRows: "Selected rows:",
      rowsPerPage: "Rows per page:",
      noData: "No rows available to display.",
      confirmDelete: "Are you sure you want to delete permanently?",
    },
    entity: {
      authRequired:
        "Authentication Required. Click 'Authenticate' below, to proceed.",
      searchAgainAfterAuth:
        "After authentication is complete, come back to this window. Search again to view the results.",
      authenticate: "Authenticate",
      selectAllHelpText: "Select all options on this page",
      selected: "Selected",
    },
    file: {
      atLeastOneUploadOption:
        "There should be at least one upload option selected in the file settings.",
      unknownFormat: "Could not upload {{filename}}. Unknown file format.",
      unknownFileFormat: "Could not upload file. Unknown file format.",
      notSupported:  "Could not upload {{filename}}. File format not supported, compress it into a ZIP file and upload again.",
      typeNotSupported: "Could not upload {{filename}}. File type not supported.",
      minSize:
        "Could not upload {{filename}}. File size must be more than {{size}}",
      maxSize:
        "Could not upload {{filename}}. File size must be less than {{size}}",
      uploadInProgress: "File upload is in progress.",
    },
    location: {
      grantPermission: "Grant location permission.",
      selectLocation: "Select Location",
      selectedLocation: "Selected Location",
      searchPlaceholder: "Search for a location...",
    },
    date: {
      selectAfter: "Select a date after {{date}}",
      selectOnOrAfter: "Select a date on or after {{date}}",
      select: "Select {{date}}",
      selectBefore: "Select a date before {{date}}",
      selectOnOrBefore: "Select a date on or before {{date}}",
      selectBeforeOrAfterDate: "Select a date before or after {{date}}",
      selectBeforeDateOrAfterDate:
        "Select a date before {{before}} or after {{after}}",
      selectBetween: "Select a date between {{min}} and {{max}}",
    },
    dateRange: {
      selectBetween: "Select a date range between {{min}} and {{max}}",
      selectOnOrAfter: "Select a date range on or after {{min}}",
      selectOnOrBefore: "Select a date range on or before {{max}}",
      selectMaxDays: "Select maximum {{days}} day(s)",
      selectMaxHours: "Select maximum {{hours}} hour(s)",
      rulesConflict:
        "Selected rules conflict, please adjust to allow a valid date range.",
    },
    radio: {
      noSelection: "No option selected.",
      noOptions: "Options not available.",
    },
    validators: {
      startDateLessThanEndDate: "Start date should be less than the End date.",
      allowedEmailDomains: "Allowed domains: {{domains}}.",
      maxDateRangeInDays: "Range should not exceed {{days}} day(s).",
      maxDateRangeInHours: "Range should not exceed {{hours}} hour(s).",
      maxLength: "Length should be less than or equal to {{length}}.",
      minLength: "Length should be greater than or equal to {{length}}.",
      maxSelection: "Cannot select more than {{count}} options.",
      minSelection: "Select at least {{count}} options.",
      maxValue: "Value should be less than or equal to {{max}}.",
      minValue: "Value should be greater than or equal to {{min}}.",
      pattern: "Value is not matching with required pattern: {{pattern}}",
      invalidPhoneNumber: "Invalid phone number.",
      required: "This field is required.",
    },
  },
};
