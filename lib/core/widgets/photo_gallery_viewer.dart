import 'dart:io';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Displays a ticket photo from either a remote URL or a local file path.
class TicketNetworkImage extends StatelessWidget {
  final String imageUrl;
  final BoxFit fit;

  const TicketNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    final isRemote =
        imageUrl.startsWith('http://') || imageUrl.startsWith('https://');

    if (!isRemote) {
      return Image.file(
        File(imageUrl),
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _errorPlaceholder(),
      );
    }

    return Image.network(
      imageUrl,
      fit: fit,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return Container(
          color: const Color(0xFFF1F5F9),
          alignment: Alignment.center,
          child: const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) => _errorPlaceholder(),
    );
  }

  Widget _errorPlaceholder() {
    return Container(
      color: const Color(0xFFF1F5F9),
      alignment: Alignment.center,
      child: const Icon(
        Icons.image_outlined,
        color: AppColors.textHint,
        size: 28,
      ),
    );
  }
}

/// Full-screen swipeable image gallery for viewing multiple uploaded ticket photos.
class PhotoGalleryViewer extends StatefulWidget {
  final List<String> photoUrls;
  final int initialIndex;

  const PhotoGalleryViewer({
    super.key,
    required this.photoUrls,
    this.initialIndex = 0,
  });

  static Future<void> open(
      BuildContext context, {
        required List<String> photoUrls,
        int initialIndex = 0,
      }) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PhotoGalleryViewer(
          photoUrls: photoUrls,
          initialIndex: initialIndex,
        ),
      ),
    );
  }

  @override
  State<PhotoGalleryViewer> createState() => _PhotoGalleryViewerState();
}

class _PhotoGalleryViewerState extends State<PhotoGalleryViewer> {
  late final PageController _pageController;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Photo ${_currentIndex + 1} of ${widget.photoUrls.length}',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              itemCount: widget.photoUrls.length,
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              itemBuilder: (context, index) {
                return Center(
                  child: InteractiveViewer(
                    minScale: 1.0,
                    maxScale: 4.0,
                    child: TicketNetworkImage(
                      imageUrl: widget.photoUrls[index],
                      fit: BoxFit.contain,
                    ),
                  ),
                );
              },
            ),
          ),
          // Bottom dot indicators when multiple photos exist
          if (widget.photoUrls.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 28, top: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(widget.photoUrls.length, (index) {
                  final isActive = index == _currentIndex;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: isActive ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: isActive ? Colors.white : Colors.white38,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }
}