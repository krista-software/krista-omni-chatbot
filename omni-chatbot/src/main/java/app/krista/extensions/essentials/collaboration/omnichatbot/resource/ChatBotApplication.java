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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource;

import app.krista.extensions.essentials.collaboration.omnichatbot.auth.ChatBotAuthResource;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.KristaExceptionMapper;
import app.krista.extensions.essentials.collaboration.omnichatbot.filter.CacheControlResponseFilter;
import app.krista.extensions.essentials.collaboration.omnichatbot.filter.CdnCacheVersionFilter;
import app.krista.extensions.essentials.collaboration.omnichatbot.filter.CorsResponseFilter;
import app.krista.omni.sdk.complex_fields.impl.rest.EntitySearchResource;
import app.krista.omni.sdk.complex_fields.impl.rest.FormApiResource;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.AuditResource;
import org.jvnet.hk2.annotations.ContractsProvided;
import org.jvnet.hk2.annotations.Service;

import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Application;
import java.util.Set;

@Service
@ContractsProvided(Application.class)
@ApplicationPath("/")
public class ChatBotApplication extends Application {

    @Override
    public Set<Class<?>> getClasses() {
        return Set.of(
                ChatBotResource.class,
                ChatBotAuthResource.class,
                AuditResource.class,
                EntitySearchResource.class,
                FormApiResource.class,
                CorsResponseFilter.class,
                CdnCacheVersionFilter.class,
                CacheControlResponseFilter.class
        );
    }

    @Override
    public Set<Object> getSingletons() {
        return Set.of(new KristaExceptionMapper());
    }

}
