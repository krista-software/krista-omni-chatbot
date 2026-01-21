export const locale_es = {
  krista: {
    general: {
      defaultErrorMessage:
        "Algo salió mal. Por favor, inténtelo de nuevo más tarde.",
      ok: "De acuerdo",
      search: "Buscar",
      cancel: "Cancelar",
      clear: "Borrar",
      remove: "Eliminar",
      delete: "Eliminar",
      save: "Guardar",
      noResults: "Entradas no encontradas",
      selectAll: "Seleccionar todo",
      unknownField: "Campo desconocido",
      enterCorrectValues: "Asegúrese de ingresar los valores apropiados.",
    },
    address: {
      street: "Calle",
      street2: "Calle # 2",
      city: "Ciudad",
      state: "Estado",
      country: "País",
      postalCode: "Código Postal",
    },
    table: {
      deletedRows: "filas eliminadas",
      selectedRows: "Filas seleccionadas:",
      rowsPerPage: "Filas por página:",
      noData: "No hay filas disponibles para mostrar.",
      confirmDelete:
        "¿Estás seguro de que quieres eliminar de forma permanente?",
    },
    entity: {
      authRequired:
        "Autenticación requerida. Haz clic en 'Autenticar' debajo para continuar.",
      searchAgainAfterAuth:
        "Después de completar la autenticación, regresa a esta ventana. Busca de nuevo para ver los resultados.",
      authenticate: "Autenticar",
      selectAllHelpText: "Seleccionar todas las opciones en esta página",
      selected: "Seleccionados",
    },
    file: {
      atLeastOneUploadOption:
        "Debe haber al menos una opción de carga seleccionada en la configuración del archivo.",
      unknownFormat:
        "No se pudo cargar {{nombre de archivo}}. Formato de archivo desconocido.",
      unknownFileFormat:
        "No se pudo cargar el archivo. Formato de archivo desconocido.",
      notSupported:
      "No se pudo subir {{filename}}. Formato de archivo no compatible, comprímalo en un archivo ZIP y vuelva a subirlo.",
      typeNotSupported: "No se pudo subir {{filename}}. Tipo de archivo no admitido.",
      minSize:
        "No se pudo cargar {{filename}}. El tamaño del archivo debe ser superior a {{size}}",
      maxSize:
        "No se pudo cargar {{filename}}. El tamaño del archivo debe ser inferior a {{size}}",
      uploadInProgress: "La carga del archivo está en curso.",
    },
    location: {
      grantPermission: "Otorgar permiso de ubicación",
      selectLocation: "Seleccionar ubicación",
      selectedLocation: "Ubicación seleccionada",
    },
    date: {
      selectAfter: "Seleccione una fecha posterior a {{date}}",
      selectOnOrAfter: "Selecciona una fecha a partir del {{date}}",
      select: "Seleccionar {{date}}",
      selectBefore: "Wählen Sie ein Datum vor dem {{date}}",
      selectOnOrBefore: "Seleccione una fecha en o antes del {{date}}",
      selectBeforeOrAfterDate:
        "Seleccione una fecha anterior o posterior a {{date}}",
      selectBeforeDateOrAfterDate:
        "Seleccione una fecha anterior al {{antes}} o posterior al {{después}}",
      selectBetween: "Seleccione una fecha entre {{min}} y {{max}}",
    },
    dateRange: {
      selectBetween:
        "Seleccione un intervalo de fechas entre {{min}} y {{max}}",
      selectOnOrAfter: "Seleccione un rango de fechas a partir del {{min}}",
      selectOnOrBefore: "Seleccione un rango de fechas en o antes del {{max}}",
      selectMaxDays: "Seleccione un máximo de {{days}} día(s)",
      selectMaxHours: "Seleccione un máximo de {{horas}} hora(s)",
      rulesConflict:
        "Existe un conflicto entre las reglas seleccionadas, por favor ajuste para permitir un rango de fechas válido.",
    },
    radio: {
      noSelection: "Ninguna opción seleccionada.",
      noOptions: "Opciones no disponibles.",
    },
    validators: {
      startDateLessThanEndDate:
        "La fecha de inicio debe ser anterior a la fecha de finalización.",
      allowedEmailDomains: "Dominios permitidos: {{domains}}.",
      maxDateRangeInDays: "El rango no debe exceder {{days}} día(s).",
      maxDateRangeInHours: "El rango no debe exceder las {{horas}} hora(s).",
      maxLength: "La longitud debe ser menor o igual a {{length}}.",
      minLength: "La longitud debe ser mayor o igual a {{length}}.",
      maxSelection: "No se pueden seleccionar más de {{count}} opciones.",
      minSelection: "Seleccione al menos {{count}} opciones.",
      maxValue: "El valor debe ser menor o igual a {{max}}.",
      minValue: "El valor debe ser mayor o igual a {{min}}.",
      pattern: "El valor no coincide con el patrón requerido: {{pattern}}",
      invalidPhoneNumber: "Numero de telefono invalido.",
      required: "Este campo es obligatorio.",
    },
  },
};
