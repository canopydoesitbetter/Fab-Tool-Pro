import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

public final class CropAndroidLaunchImage {
    private static final double APPROVED_PORTRAIT_RATIO = 941.0 / 1672.0;

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: CropAndroidLaunchImage <input> <output>");
        }

        BufferedImage source = ImageIO.read(new File(args[0]));
        if (source == null) throw new IllegalArgumentException("Could not decode Android launch artwork.");

        int cropX = 0;
        int cropY = 0;
        int cropWidth = source.getWidth();
        int cropHeight = source.getHeight();
        double sourceRatio = cropWidth / (double) cropHeight;

        if (sourceRatio > APPROVED_PORTRAIT_RATIO) {
            cropWidth = Math.max(1, (int) Math.round(cropHeight * APPROVED_PORTRAIT_RATIO));
            cropX = Math.max(0, (source.getWidth() - cropWidth) / 2);
        } else if (sourceRatio < APPROVED_PORTRAIT_RATIO) {
            cropHeight = Math.max(1, (int) Math.round(cropWidth / APPROVED_PORTRAIT_RATIO));
            cropY = Math.max(0, (source.getHeight() - cropHeight) / 2);
        }

        BufferedImage cropped = source.getSubimage(cropX, cropY, cropWidth, cropHeight);
        BufferedImage rgb = new BufferedImage(cropWidth, cropHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rgb.createGraphics();
        try {
            graphics.drawImage(cropped, 0, 0, null);
        } finally {
            graphics.dispose();
        }

        File output = new File(args[1]);
        File parent = output.getParentFile();
        if (parent != null) parent.mkdirs();

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) throw new IllegalStateException("No JPEG writer is available.");
        ImageWriter writer = writers.next();
        try (ImageOutputStream stream = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(stream);
            ImageWriteParam params = writer.getDefaultWriteParam();
            if (params.canWriteCompressed()) {
                params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                params.setCompressionQuality(0.92f);
            }
            writer.write(null, new IIOImage(rgb, null, null), params);
        } finally {
            writer.dispose();
        }

        System.out.printf("Fabri-Cadabra Android launch artwork cropped to %dx%d.%n", cropWidth, cropHeight);
    }
}
