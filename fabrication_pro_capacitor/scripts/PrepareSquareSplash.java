import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

public final class PrepareSquareSplash {
    private static final int TARGET_SIZE = 2732;

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: PrepareSquareSplash <portrait-input> <square-output>");
        }

        BufferedImage source = ImageIO.read(new File(args[0]));
        if (source == null) throw new IllegalArgumentException("Could not decode Fabri-Cadabra launch artwork.");

        BufferedImage canvas = new BufferedImage(TARGET_SIZE, TARGET_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = canvas.createGraphics();
        try {
            int sample = Math.max(1, Math.min(24, Math.min(source.getWidth(), source.getHeight())));
            long red = 0, green = 0, blue = 0, count = 0;
            int[][] corners = {
                {0, 0},
                {source.getWidth() - sample, 0},
                {0, source.getHeight() - sample},
                {source.getWidth() - sample, source.getHeight() - sample}
            };
            for (int[] corner : corners) {
                for (int y = corner[1]; y < corner[1] + sample; y++) {
                    for (int x = corner[0]; x < corner[0] + sample; x++) {
                        int rgb = source.getRGB(x, y);
                        red += (rgb >>> 16) & 0xff;
                        green += (rgb >>> 8) & 0xff;
                        blue += rgb & 0xff;
                        count++;
                    }
                }
            }
            Color background = new Color(
                (int) Math.max(0, Math.min(255, (red / count) * 0.65)),
                (int) Math.max(0, Math.min(255, (green / count) * 0.65)),
                (int) Math.max(0, Math.min(255, (blue / count) * 0.65))
            );
            graphics.setColor(background);
            graphics.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

            double scale = Math.min(TARGET_SIZE / (double) source.getWidth(), TARGET_SIZE / (double) source.getHeight());
            int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
            int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
            int x = (TARGET_SIZE - width) / 2;
            int y = (TARGET_SIZE - height) / 2;

            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, x, y, width, height, null);
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
            writer.write(null, new IIOImage(canvas, null, null), params);
        } finally {
            writer.dispose();
        }

        System.out.printf("Fabri-Cadabra square native splash source prepared at %dx%d.%n", TARGET_SIZE, TARGET_SIZE);
    }
}
