/*
 * Copyright 2026 PraxisCORE contributors.
 * Licensed under the GNU Lesser General Public License version 3.
 */
package org.praxislive.launcher;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.stream.Collectors;
import org.praxislive.base.AbstractRoot;
import org.praxislive.core.Call;
import org.praxislive.core.ControlAddress;
import org.praxislive.core.PacketRouter;
import org.praxislive.core.Value;
import org.praxislive.core.services.ScriptService;
import org.praxislive.core.services.Services;
import org.praxislive.core.types.PError;
import org.praxislive.core.types.PString;

/** Serialized automation transport. One base64 UTF-8 script per input line. */
final class MachineTerminalIO extends AbstractRoot {
    private Thread input;
    private ControlAddress service;

    @Override
    protected void activating() { setRunning(); }

    @Override
    protected void starting() {
        service = getLookup().find(Services.class)
                .flatMap(s -> s.locate(ScriptService.class))
                .map(c -> ControlAddress.of(c, ScriptService.EVAL)).orElseThrow();
        input = new Thread(this::readInput, "praxis-machine-input");
        input.setDaemon(true);
        input.start();
        System.out.println("PRAXIS_READY");
    }

    @Override
    protected void terminating() { if (input != null) input.interrupt(); }

    @Override
    protected void processCall(Call call, PacketRouter router) {
        if (call.isRequest()) {
            router.route(call.error(PError.of("Unsupported operation")));
            return;
        }
        respond(call.isReply(), call.args().stream().map(Value::toString)
                .collect(Collectors.joining(" ")));
    }

    private static void respond(boolean ok, String text) {
        System.out.println((ok ? "PRAXIS_OK " : "PRAXIS_ERROR ")
                + Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)));
    }

    private void readInput() {
        try {
            var reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                try {
                    String script = new String(Base64.getDecoder().decode(line), StandardCharsets.UTF_8);
                    invokeLater(() -> getRouter().route(Call.create(service,
                            ControlAddress.of(getAddress(), "io"), getExecutionContext().getTime(),
                            PString.of(script))));
                } catch (IllegalArgumentException ex) {
                    respond(false, "Invalid base64 script");
                }
            }
        } catch (java.io.IOException ex) {
            System.err.println("Machine input closed: " + ex.getMessage());
        }
    }
}
