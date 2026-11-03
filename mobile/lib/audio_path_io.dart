import 'dart:io';

Future<String> chatAudioPath(String id) async =>
    '${Directory.systemTemp.path}/chat-$id.m4a';
