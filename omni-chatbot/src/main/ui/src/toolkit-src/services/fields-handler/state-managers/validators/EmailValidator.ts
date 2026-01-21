import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

// TODO
function isValidEmail(email: string): boolean {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

export class EmailValidator extends FieldValidator {
  constructor(private readonly allowedDomains: string[], fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value) {
      const trimmedValue = value.trim().toLowerCase();
      if (!trimmedValue || !isValidEmail(trimmedValue)) {
        errors.push("Invalid email.");
      }

      if (this.allowedDomains && this.allowedDomains.length > 0) {
        const validDomain =
          this.allowedDomains.filter((domain) =>
            trimmedValue.endsWith(`@${domain.trim().toLowerCase()}`)
          ).length > 0;
        if (!validDomain) {
          errors.push(
            i18next.t("krista.validators.allowedEmailDomains", {
              domains: this.allowedDomains.join(", "),
            })
          );
        }
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
