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

import app.krista.ksdk.accounts.AttributeManager;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

/**
 * Validates the {@code attribute_parameters} field present in extension setup attributes.
 *
 * <p>Extracted from {@code ChatBotExtension} so that the validation logic can be tested
 * independently without standing up the full Krista container.  Both
 * {@code ChatBotExtension.validateAttributes} and the test suite delegate here.
 *
 * <p>Dependencies: only {@link AttributeManager} – no Invoker, no SessionStore, no container
 * singletons.
 */
@Service
public class AttributeParameterValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(AttributeParameterValidator.class);

    private final AttributeManager attributeManager;

    @Inject
    public AttributeParameterValidator(AttributeManager attributeManager) {
        this.attributeManager = attributeManager;
    }

    /**
     * Validates the {@code attribute_parameters} entry inside {@code setupAttributes}.
     *
     * <p>If the entry is absent or blank the method returns silently.  Otherwise it parses
     * the value as JSON and verifies that every key in the JSON object corresponds to an
     * existing workspace attribute.
     *
     * @param setupAttributes map of extension setup attributes
     * @throws IllegalArgumentException if the value is not valid JSON, or if any JSON key does
     *                                  not match an existing workspace attribute
     */
    public void validate(Map<String, Object> setupAttributes) {
        Object rawValue = setupAttributes.get(AuthConstants.ATTRIBUTE_PARAMETERS);
        String userAttributesValues = rawValue == null ? "" : rawValue.toString();
        if (userAttributesValues.isBlank()) {
            return;
        }
        try {
            JsonObject jsonObject = JsonParser.parseString(userAttributesValues).getAsJsonObject();
            List<String> invalidAttributes = new ArrayList<>();
            for (String attributeName : jsonObject.keySet()) {
                if (!attributeExists(attributeName)) {
                    invalidAttributes.add(attributeName);
                }
            }
            if (!invalidAttributes.isEmpty()) {
                throw new IllegalArgumentException(
                        "Missing attribute(s). Please create the following attribute(s): "
                                + String.join(", ", invalidAttributes));
            }
        } catch (JsonSyntaxException | IllegalStateException cause) {
            LOGGER.error("Invalid JSON Found : {}", cause.getMessage(), cause);
            throw new IllegalArgumentException(
                    "Invalid Json format found please verify Json entered for Attributes Parameter");
        }
    }

    private boolean attributeExists(String attribute) {
        try {
            return StreamSupport.stream(attributeManager.getAttributes().spliterator(), false)
                    .anyMatch(attr -> attribute.equals(attr.getName()));
        } catch (RuntimeException cause) {
            LOGGER.error("Error while verifying attribute existence. Attribute Name: {} : {}",
                    attribute, cause.getMessage(), cause);
            return false;
        }
    }
}
