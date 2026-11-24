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

import app.krista.extension.authorization.AuthorizationException;
import app.krista.ksdk.accounts.Attribute;
import app.krista.ksdk.accounts.AttributeManager;
import app.krista.ksdk.accounts.ModifiableAttribute;
import app.krista.ksdk.authorization.Role;
import app.krista.model.field.Field;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for {@link AttributeParameterValidator}.
 *
 * <p>The validator was extracted from {@code ChatBotExtension.validateAttributeParameters} +
 * {@code verifyAttributeExists} so that the JSON/attribute-check logic can be exercised
 * without standing up the full Krista container (which requires an {@code Invoker},
 * {@code ConversationsSearch}, {@code InteractiveMediumService}, etc.).
 *
 * <p>Test infrastructure uses real, minimal implementations of {@link AttributeManager} and
 * {@link ModifiableAttribute} rather than mocks.  Each implementation only overrides the
 * single method under test and throws {@link UnsupportedOperationException} for the rest –
 * this ensures we do not accidentally rely on no-op mock behaviour.
 *
 * <p>Ported from guest-authentication's {@code GuestAuthenticationExtensionTest}
 * (the {@code validateAttributes} tests) and re-located to omni-chatbot, which now owns
 * the migrated code.
 */
@DisplayName("AttributeParameterValidator Tests")
class AttributeParameterValidatorTest {

    // -------------------------------------------------------------------------
    // Minimal real implementations – no mock framework
    // -------------------------------------------------------------------------

    /**
     * Lightweight {@link ModifiableAttribute} that carries only a name.
     * All other interface methods throw {@link UnsupportedOperationException} to
     * surface accidental calls.
     */
    private static final class NamedAttribute implements ModifiableAttribute {

        private final String name;

        NamedAttribute(String name) {
            this.name = name;
        }

        @Override
        public String getName() {
            return name;
        }

        // -- Attribute contract (unused in tests) --

        @Override
        public String getAttributeId() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public Set<Role> getRequiredRoles() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public Field getField() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        // -- Modifiable<Attribute> contract (unused in tests) --

        @Override
        public Attribute unmodifiable() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        // -- ModifiableAttribute contract (unused in tests) --

        @Override
        public void setPublic(boolean isPublic) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public void addRequiredRole(String... roleName) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public void removeRequiredRole(String... roleName) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public void renameAttribute(String name) {
            throw new UnsupportedOperationException("not needed in tests");
        }
    }

    /**
     * Lightweight {@link AttributeManager} backed by a fixed list of attributes.
     * Only {@link #getAttributes()} is implemented; all other methods throw to
     * prevent accidental use.
     */
    private static final class FixedAttributeManager implements AttributeManager {

        private final List<ModifiableAttribute> attributes;

        FixedAttributeManager(ModifiableAttribute... attributes) {
            this.attributes = Arrays.asList(attributes);
        }

        @Override
        public Iterable<ModifiableAttribute> getAttributes() {
            return attributes;
        }

        // -- Remaining AttributeManager / AttributeProvider methods (unused in tests) --

        @Override
        public ModifiableAttribute lookupAttribute(String attributeName) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public int getTotalAttributes() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public Iterable<String> getAttributeIds() {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public ModifiableAttribute getAttribute(String attributeId) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public ModifiableAttribute createAttribute(String attributeName, Field field) {
            throw new UnsupportedOperationException("not needed in tests");
        }

        @Override
        public ModifiableAttribute ensureAttributeExists(String attributeName, Field field) {
            throw new UnsupportedOperationException("not needed in tests");
        }
    }

    // -------------------------------------------------------------------------
    // Test setup
    // -------------------------------------------------------------------------

    private AttributeParameterValidator validator;

    /**
     * Build a {@link Map} containing an {@code attribute_parameters} entry whose value
     * is the supplied JSON string, mirroring how {@code ChatBotExtension.validateAttributes}
     * passes its {@code setupAttributes} map down to the validator.
     */
    private static Map<String, Object> setupAttributes(String attributeParametersJson) {
        Map<String, Object> map = new HashMap<>();
        map.put(AuthConstants.ATTRIBUTE_PARAMETERS, attributeParametersJson);
        return map;
    }

    // -------------------------------------------------------------------------
    // blank / missing attribute_parameters – no-op
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("When attribute_parameters is absent or blank")
    class BlankOrAbsent {

        @BeforeEach
        void setUp() {
            // Attribute manager is not consulted when the value is blank/absent
            validator = new AttributeParameterValidator(new FixedAttributeManager());
        }

        @Test
        @DisplayName("Should return silently when attribute_parameters key is absent")
        void shouldPassWhenKeyAbsent() {
            assertDoesNotThrow(() -> validator.validate(Collections.emptyMap()),
                    "Missing attribute_parameters must be treated as no-op");
        }

        @Test
        @DisplayName("Should return silently when attribute_parameters value is blank")
        void shouldPassWhenValueBlank() {
            assertDoesNotThrow(() -> validator.validate(setupAttributes("")),
                    "Blank attribute_parameters must be treated as no-op");
        }

        @Test
        @DisplayName("Should return silently when attribute_parameters value is whitespace only")
        void shouldPassWhenValueWhitespace() {
            assertDoesNotThrow(() -> validator.validate(setupAttributes("   ")),
                    "Whitespace-only attribute_parameters must be treated as no-op");
        }
    }

    // -------------------------------------------------------------------------
    // valid JSON, all attributes exist
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("When attribute_parameters contains valid JSON and all attributes exist")
    class ValidJsonAllAttributesExist {

        @Test
        @DisplayName("Should not throw when every JSON key maps to a known workspace attribute")
        void shouldPassWhenAllAttributesExist() {
            // Given
            validator = new AttributeParameterValidator(new FixedAttributeManager(
                    new NamedAttribute("GUEST_SOURCE"),
                    new NamedAttribute("ACCESS_LEVEL")
            ));
            Map<String, Object> attrs = setupAttributes(
                    "{\"GUEST_SOURCE\":\"Portal\",\"ACCESS_LEVEL\":\"Read-Only\"}");

            // Then
            assertDoesNotThrow(() -> validator.validate(attrs),
                    "All attributes present – must not throw");
        }

        @Test
        @DisplayName("Should not throw for JSON with a single attribute that exists")
        void shouldPassForSingleExistingAttribute() {
            // Given
            validator = new AttributeParameterValidator(new FixedAttributeManager(
                    new NamedAttribute("MY_ATTR")
            ));

            assertDoesNotThrow(() -> validator.validate(setupAttributes("{\"MY_ATTR\":\"value\"}")),
                    "Single matching attribute must not throw");
        }
    }

    // -------------------------------------------------------------------------
    // invalid JSON
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("When attribute_parameters contains invalid JSON")
    class InvalidJson {

        @BeforeEach
        void setUp() {
            // Attribute manager is not reached when JSON parsing fails
            validator = new AttributeParameterValidator(new FixedAttributeManager());
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException describing the JSON format error")
        void shouldThrowForInvalidJson() {
            // When
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(setupAttributes("{invalid json}")),
                    "Invalid JSON must cause IllegalArgumentException");

            // Then – verify the message tells the operator what went wrong
            assertTrue(ex.getMessage().contains("Invalid Json format"),
                    "Exception message must mention 'Invalid Json format', was: " + ex.getMessage());
        }

        @Test
        @DisplayName("Should throw for JSON array instead of object")
        void shouldThrowForJsonArray() {
            assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(setupAttributes("[\"not\",\"an\",\"object\"]")),
                    "JSON array instead of object must throw");
        }

        @Test
        @DisplayName("Should throw for bare JSON string")
        void shouldThrowForBareJsonString() {
            assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(setupAttributes("\"just a string\"")),
                    "Bare JSON string must throw");
        }
    }

    // -------------------------------------------------------------------------
    // valid JSON but attributes missing from workspace
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("When attribute_parameters references attributes absent from the workspace")
    class MissingAttributes {

        @Test
        @DisplayName("Should throw and name the missing attribute when one attribute is absent")
        void shouldThrowNamingMissingAttribute() {
            // Given
            validator = new AttributeParameterValidator(new FixedAttributeManager(
                    new NamedAttribute("EXISTING_ATTR")
            ));
            Map<String, Object> attrs = setupAttributes("{\"NON_EXISTENT_ATTR\":\"value\"}");

            // When
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(attrs),
                    "Missing attribute must cause IllegalArgumentException");

            // Then – message must identify which attribute is missing
            assertTrue(ex.getMessage().contains("NON_EXISTENT_ATTR"),
                    "Exception message must name the missing attribute, was: " + ex.getMessage());
            assertTrue(ex.getMessage().contains("Missing attribute"),
                    "Exception message must contain 'Missing attribute', was: " + ex.getMessage());
        }

        @Test
        @DisplayName("Should throw and name all missing attributes when multiple are absent")
        void shouldThrowNamingAllMissingAttributes() {
            // Given
            validator = new AttributeParameterValidator(new FixedAttributeManager(
                    new NamedAttribute("EXISTING")
            ));
            Map<String, Object> attrs = setupAttributes(
                    "{\"MISSING_ONE\":\"v1\",\"MISSING_TWO\":\"v2\"}");

            // When
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(attrs));

            // Then
            String msg = ex.getMessage();
            assertTrue(msg.contains("MISSING_ONE"), "Message must name MISSING_ONE, was: " + msg);
            assertTrue(msg.contains("MISSING_TWO"), "Message must name MISSING_TWO, was: " + msg);
        }

        @Test
        @DisplayName("Should throw when workspace has no attributes at all")
        void shouldThrowWhenWorkspaceHasNoAttributes() {
            // Given
            validator = new AttributeParameterValidator(new FixedAttributeManager());
            Map<String, Object> attrs = setupAttributes("{\"SOME_ATTR\":\"value\"}");

            // When / Then
            assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(attrs),
                    "No workspace attributes at all must cause IllegalArgumentException");
        }

        @Test
        @DisplayName("Should not throw for attributes that exist even when some are missing")
        void shouldThrowOnlyForMissingOnes() {
            // Given – workspace has A but not B
            validator = new AttributeParameterValidator(new FixedAttributeManager(
                    new NamedAttribute("ATTR_A")
            ));
            Map<String, Object> attrs = setupAttributes("{\"ATTR_A\":\"ok\",\"ATTR_B\":\"missing\"}");

            // When
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> validator.validate(attrs));

            // Then – only ATTR_B should be listed
            String msg = ex.getMessage();
            assertTrue(msg.contains("ATTR_B"), "ATTR_B must be listed as missing, was: " + msg);
            assertFalse(msg.contains("ATTR_A"), "ATTR_A must NOT be listed as missing, was: " + msg);
        }
    }
}
