/*
 * Omni Chatbot Extension for Krista
 * Copyright (C) 2025 Krista Software
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package app.krista.extensions.essentials.collaboration.omnichatbot.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link CommonUtils} – pure static helper methods with no external dependencies.
 * Ported from guest-authentication's CommonUtilsTest (JUnit 4) to JUnit 5 and re-located to
 * the omni-chatbot module, which now owns the class after the guest-auth migration.
 */
@DisplayName("CommonUtils Tests")
class CommonUtilsTest {

    // -------------------------------------------------------------------------
    // getDate
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("getDate")
    class GetDate {

        @Test
        @DisplayName("Should return ISO-like date string containing current year and month in GMT")
        void shouldReturnCurrentDateInGmt() {
            // Given
            Date now = new Date();
            LocalDate localDate = now.toInstant().atZone(ZoneId.of("GMT")).toLocalDate();
            int expectedYear = localDate.getYear();
            int expectedMonth = localDate.getMonthValue();
            String expectedMonthStr = expectedMonth < 10 ? "0" + expectedMonth : "" + expectedMonth;

            // When
            String date = CommonUtils.getDate();
            String[] parts = date.split("-");

            // Then
            assertNotNull(date, "getDate() must not return null");
            assertTrue(date.contains("T"), "Date string must contain 'T' time-separator");
            assertEquals(String.valueOf(expectedYear), parts[0], "Year segment must match current GMT year");
            assertEquals(expectedMonthStr, parts[1], "Month segment must match current GMT month");
            assertTrue(date.endsWith("+0000"), "Date string must end with '+0000' (GMT offset)");
        }
    }

    // -------------------------------------------------------------------------
    // isValidDomain
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("isValidDomain")
    class IsValidDomain {

        @Test
        @DisplayName("Should return false for domain without TLD")
        void shouldRejectDomainWithoutTld() {
            assertFalse(CommonUtils.isValidDomain("dummy"), "Single-label string is not a valid domain");
        }

        @Test
        @DisplayName("Should return true for well-formed domain")
        void shouldAcceptWellFormedDomain() {
            assertTrue(CommonUtils.isValidDomain("kristasoft.com"), "kristasoft.com must be valid");
        }

        @Test
        @DisplayName("Should return false for null input")
        void shouldRejectNull() {
            assertFalse(CommonUtils.isValidDomain(null), "null must not be a valid domain");
        }

        @Test
        @DisplayName("Should return false for empty string")
        void shouldRejectEmptyString() {
            assertFalse(CommonUtils.isValidDomain(""), "Empty string must not be a valid domain");
        }
    }

    // -------------------------------------------------------------------------
    // isEmailDomainPresentInSupportedWorkspaceDomains
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("isEmailDomainPresentInSupportedWorkspaceDomains")
    class IsEmailDomainPresentInSupportedWorkspaceDomains {

        @Test
        @DisplayName("Should return false when both email and domains are empty")
        void shouldReturnFalseForBothEmpty() {
            assertFalse(CommonUtils.isEmailDomainPresentInSupportedWorkspaceDomains("", ""),
                    "Empty email must return false");
        }

        @Test
        @DisplayName("Should return false when email is null")
        void shouldReturnFalseForNullEmail() {
            assertFalse(CommonUtils.isEmailDomainPresentInSupportedWorkspaceDomains(null, ""),
                    "Null email must return false");
        }

        @Test
        @DisplayName("Should return false when email domain is not in the supported list")
        void shouldReturnFalseWhenDomainNotInList() {
            assertFalse(
                    CommonUtils.isEmailDomainPresentInSupportedWorkspaceDomains("abc@wrong.com", "example.com"),
                    "wrong.com should not be found in example.com");
        }

        @Test
        @DisplayName("Should return true when email domain is present in comma-separated supported domains")
        void shouldReturnTrueWhenDomainPresent() {
            assertTrue(
                    CommonUtils.isEmailDomainPresentInSupportedWorkspaceDomains(
                            "abc@example.com", "example.com,kristasoft.com"),
                    "example.com should be found in the supported list");
        }
    }

    // -------------------------------------------------------------------------
    // isValidEmail
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("isValidEmail")
    class IsValidEmail {

        @Test
        @DisplayName("Should return false for malformed email string")
        void shouldRejectMalformedEmail() {
            assertFalse(CommonUtils.isValidEmail("exa.ada"), "exa.ada is not a valid email");
        }

        @Test
        @DisplayName("Should return true for well-formed email")
        void shouldAcceptWellFormedEmail() {
            assertTrue(CommonUtils.isValidEmail("abc@kristasoft.com"), "abc@kristasoft.com must be valid");
        }

        @Test
        @DisplayName("Should return false for null input")
        void shouldRejectNull() {
            assertFalse(CommonUtils.isValidEmail(null), "null must not be a valid email");
        }

        @Test
        @DisplayName("Should return false for empty string")
        void shouldRejectEmptyString() {
            assertFalse(CommonUtils.isValidEmail(""), "Empty string must not be a valid email");
        }
    }

    // -------------------------------------------------------------------------
    // validateDomains
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("validateDomains")
    class ValidateDomains {

        @Test
        @DisplayName("Should throw IllegalArgumentException for empty string")
        void shouldThrowForEmptyString() {
            assertThrows(IllegalArgumentException.class,
                    () -> CommonUtils.validateDomains(""),
                    "Empty domain string must throw IllegalArgumentException");
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for null input")
        void shouldThrowForNull() {
            assertThrows(IllegalArgumentException.class,
                    () -> CommonUtils.validateDomains(null),
                    "Null input must throw IllegalArgumentException");
        }

        @Test
        @DisplayName("Should not throw for valid comma-separated domain list")
        void shouldNotThrowForValidDomains() {
            assertDoesNotThrow(() -> CommonUtils.validateDomains("example.com,kristasoft.com"),
                    "Valid comma-separated domain list must not throw");
        }
    }

    // -------------------------------------------------------------------------
    // validateIfSupportedDomain
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("validateIfSupportedDomain")
    class ValidateIfSupportedDomain {

        @Test
        @DisplayName("Should throw IllegalArgumentException when all arguments are null")
        void shouldThrowWhenAllNull() {
            assertThrows(IllegalArgumentException.class,
                    () -> CommonUtils.validateIfSupportedDomain(null, null, null),
                    "Null email must cause an IllegalArgumentException");
        }
    }
}
