import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';

import 'audio_path_stub.dart' if (dart.library.io) 'audio_path_io.dart';
import 'design/la_design.dart';
import 'domain.dart';
import 'lab_api.dart';

const _emojis = ['😀', '👍', '✅', '⚠️', '📞', '🔧', '🙏', '👀'];

/// Conversa da OS. Recados do vendedor entram à esquerda; o laboratório responde à direita.
class OsChat extends StatefulWidget {
  const OsChat({
    super.key,
    required this.orderId,
    required this.author,
    required this.canWrite,
    required this.legacy,
    this.onTalk,
  });

  final String orderId;
  final String author;
  final bool canWrite;
  final List<Map<String, dynamic>> legacy;
  final ValueChanged<bool>? onTalk;

  @override
  State<OsChat> createState() => _OsChatState();
}

class _OsChatState extends State<OsChat> {
  final api = LabApi();
  final text = TextEditingController();
  final recorder = AudioRecorder();
  final player = AudioPlayer();
  List<Map<String, dynamic>> chat = [];
  bool sending = false;
  bool recording = false;
  String? error;
  String? playingId;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    text.dispose();
    recorder.dispose();
    player.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final rows = await api.chatMessages(widget.orderId);
    if (!mounted) return;
    setState(() => chat = rows);
    widget.onTalk?.call(widget.legacy.isNotEmpty || rows.isNotEmpty);
    for (final item in widget.legacy) {
      if (item['status'] == 'novo') {
        api.markNoteSeen(item['id'] as String);
      }
    }
  }

  List<_Bubble> get bubbles {
    final items = <_Bubble>[];
    for (final message in widget.legacy) {
      items.add(
        _Bubble(
          id: '${message['id']}',
          mine: false,
          label: '${message['sender_label'] ?? 'Vendedor'}',
          body: '${message['body'] ?? ''}',
          at: '${message['created_at'] ?? ''}',
        ),
      );
      final reply = '${message['reply_body'] ?? ''}'.trim();
      if (reply.isNotEmpty) {
        items.add(
          _Bubble(
            id: '${message['id']}-resposta',
            mine: true,
            label: 'Laboratório',
            body: reply,
            at: '${message['replied_at'] ?? message['created_at'] ?? ''}',
          ),
        );
      }
    }
    for (final message in chat) {
      final body = '${message['body'] ?? ''}'.trim();
      items.add(
        _Bubble(
          id: '${message['id']}',
          mine: message['author_kind'] == 'lab',
          label: '${message['author_label'] ?? ''}',
          body: body,
          audioUrl: message['audio_url'] as String?,
          at: '${message['created_at'] ?? ''}',
        ),
      );
    }
    items.sort((a, b) => a.at.compareTo(b.at));
    return items;
  }

  Future<void> sendText() async {
    final body = text.text.trim();
    if (body.isEmpty || sending) return;
    setState(() {
      sending = true;
      error = null;
    });
    try {
      await api.sendChatText(
        orderId: widget.orderId,
        body: body,
        label: widget.author,
      );
      text.clear();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> toggleAudio() async {
    if (!widget.canWrite || sending) return;
    if (recording) {
      setState(() => sending = true);
      try {
        final path = await recorder.stop();
        setState(() => recording = false);
        if (path == null || path.isEmpty) return;
        final bytes = await XFile(path).readAsBytes();
        final mime = kIsWeb ? 'audio/wav' : 'audio/mp4';
        await api.sendChatAudio(
          orderId: widget.orderId,
          bytes: bytes,
          label: widget.author,
          mime: mime,
        );
        await load();
      } catch (e) {
        if (mounted) setState(() => error = friendlyError(e));
      } finally {
        if (mounted) setState(() => sending = false);
      }
      return;
    }
    try {
      final allowed = await recorder.hasPermission();
      if (!allowed) {
        setState(() => error = 'O celular precisa permitir o microfone.');
        return;
      }
      final path = await chatAudioPath(widget.orderId);
      await recorder.start(
        RecordConfig(encoder: kIsWeb ? AudioEncoder.wav : AudioEncoder.aacLc),
        path: path,
      );
      setState(() {
        recording = true;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> play(String id, String url) async {
    if (playingId == id) {
      await player.stop();
      setState(() => playingId = null);
      return;
    }
    await player.stop();
    await player.play(UrlSource(url));
    setState(() => playingId = id);
    player.onPlayerComplete.first.then((_) {
      if (mounted && playingId == id) setState(() => playingId = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final items = bubbles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Conversa', style: LaType.tituloSecao),
        SizedBox(height: LaSpace.item),
        if (items.isEmpty)
          Text('Nenhuma conversa nesta OS.', style: LaType.apoio)
        else
          for (final item in items) ...[
            _BubbleView(
              item: item,
              playing: playingId == item.id,
              onPlay: item.audioUrl == null
                  ? null
                  : () => play(item.id, item.audioUrl!),
            ),
            SizedBox(height: LaSpace.s),
          ],
        if (widget.canWrite) ...[
          SizedBox(height: LaSpace.item),
          Wrap(
            spacing: 4,
            children: [
              for (final emoji in _emojis)
                SizedBox(
                  width: LaSize.toque,
                  height: LaSize.toque,
                  child: InkWell(
                    onTap: () => text.text = '${text.text}$emoji',
                    child: Center(
                      child: Text(emoji, style: TextStyle(fontSize: 22)),
                    ),
                  ),
                ),
            ],
          ),
          SizedBox(height: LaSpace.s),
          TextField(
            controller: text,
            minLines: 1,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'Escrever na OS',
              filled: true,
              fillColor: LaColors.surface(context),
            ),
          ),
          SizedBox(height: LaSpace.item),
          Row(
            children: [
              SizedBox(
                width: LaSize.toque,
                height: LaSize.toque,
                child: IconButton(
                  tooltip: recording ? 'Parar e enviar áudio' : 'Gravar áudio',
                  onPressed: sending ? null : toggleAudio,
                  icon: Icon(
                    recording ? Icons.stop_circle : Icons.mic_none,
                    color: recording ? LaColors.adapt(context, LaColors.perigo) : LaColors.adapt(context, LaColors.grafite),
                  ),
                ),
              ),
              SizedBox(width: LaSpace.item),
              Expanded(
                child: LaButton(
                  label: recording ? 'Enviar áudio' : 'Enviar',
                  variant: LaButtonVariant.escuro,
                  loading: sending,
                  onPressed: sending
                      ? null
                      : (recording ? toggleAudio : sendText),
                ),
              ),
            ],
          ),
          if (error != null) ...[
            SizedBox(height: LaSpace.s),
            Text(error!, style: LaType.apoio.copyWith(color: LaColors.adapt(context, LaColors.perigo))),
          ],
        ],
      ],
    );
  }
}

class _Bubble {
  const _Bubble({
    required this.id,
    required this.mine,
    required this.label,
    required this.body,
    required this.at,
    this.audioUrl,
  });

  final String id;
  final bool mine;
  final String label;
  final String body;
  final String at;
  final String? audioUrl;
}

class _BubbleView extends StatelessWidget {
  const _BubbleView({required this.item, required this.playing, this.onPlay});

  final _Bubble item;
  final bool playing;
  final VoidCallback? onPlay;

  @override
  Widget build(BuildContext context) {
    final mine = item.mine;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 320),
        child: DecoratedBox(
          decoration: BoxDecoration(
            // Balão "meu" igual ao do site (verde claro / verde escuro).
            color: mine ? (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF005C4B) : const Color(0xFFD9FDD3)) : LaColors.surface(context),
            borderRadius: LaRadius.rCartao,
          ),
          child: Padding(
            padding: EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  style: LaType.rotulo.copyWith(
                    color: mine ? LaColors.adapt(context, LaColors.regua) : LaColors.adapt(context, LaColors.regua),
                  ),
                ),
                if (item.body.isNotEmpty)
                  Text(
                    item.body,
                    style: LaType.corpo.copyWith(
                      color: LaColors.adapt(context, LaColors.grafite),
                    ),
                  ),
                if (onPlay != null)
                  TextButton(
                    onPressed: onPlay,
                    child: Text(
                      playing ? 'Parar' : 'Ouvir áudio',
                      style: LaType.rotulo.copyWith(
                        color: LaColors.adapt(context, LaColors.grafite),
                      ),
                    ),
                  ),
                Text(
                  formatWhen(item.at),
                  style: LaType.apoio.copyWith(
                    color: mine ? LaColors.adapt(context, LaColors.linha) : LaColors.adapt(context, LaColors.regua),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
