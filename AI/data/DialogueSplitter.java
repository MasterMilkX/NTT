// Does that dialogue splittin' thing??? //

import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.regex.*;

public class DialogueSplitter {

    private static final Pattern SPLIT_PATTERN =
        Pattern.compile("(?<=[.!?;])\\s+(?=[A-Z0-9“\"'*])");

    public static void main(String[] args) throws IOException {
        // Load the JSON file as a String
        String jsonText = Files.readString(Path.of("role_dialog.json"));

        JSONObject root = new JSONObject(jsonText);
        JSONObject processed = processObject(root);

        // Write back to a new file
        Files.writeString(Path.of("dialogue_split.json"), processed.toString(4));
        System.out.println("Dialogue successfully split and saved to dialogue_split.json!");
    }

    // --- Recursive Processing Functions ---

    private static JSONObject processObject(JSONObject obj) {
        JSONObject newObj = new JSONObject();
        for (String key : obj.keySet()) {
            Object value = obj.get(key);
            newObj.put(key, processValue(value));
        }
        return newObj;
    }

    private static JSONArray processArray(JSONArray arr) {
        JSONArray newArr = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            Object value = arr.get(i);
            Object processed = processValue(value);
            if (processed instanceof JSONArray) {
                // Flatten: merge sublists into one array
                JSONArray inner = (JSONArray) processed;
                for (int j = 0; j < inner.length(); j++) {
                    newArr.put(inner.get(j));
                }
            } else {
                newArr.put(processed);
            }
        }
        return newArr;
    }

    private static Object processValue(Object value) {
        if (value instanceof JSONObject) {
            return processObject((JSONObject) value);
        } else if (value instanceof JSONArray) {
            return processArray((JSONArray) value);
        } else if (value instanceof String) {
            return splitSentence((String) value);
        } else {
            return value;
        }
    }

    // --- Sentence Splitter ---
    private static Object splitSentence(String text) {
        String[] parts = SPLIT_PATTERN.split(text);
        if (parts.length > 1) {
            JSONArray arr = new JSONArray();
            for (String p : parts) {
                String clean = p.trim();
                if (!clean.isEmpty()) arr.put(clean);
            }
            return arr;
        }
        return text.trim();
    }
}
